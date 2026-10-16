use anyhow::{Context, Result, bail};
use std::{
    ffi::{OsStr, OsString},
    mem::{size_of, zeroed},
    os::windows::{
        ffi::OsStrExt,
        io::{AsRawHandle, FromRawHandle, OwnedHandle},
    },
    ptr::{null, null_mut},
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::{Duration, Instant},
};
use windows_sys::Win32::{
    Foundation::{
        ERROR_ALREADY_EXISTS, GetLastError, HANDLE, HANDLE_FLAG_INHERIT, INVALID_HANDLE_VALUE,
        SetHandleInformation, WAIT_OBJECT_0,
    },
    Globalization::{CSTR_EQUAL, CompareStringOrdinal},
    System::{
        JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JobObjectBasicAccountingInformation, JobObjectExtendedLimitInformation,
            QueryInformationJobObject, SetInformationJobObject, TerminateJobObject,
        },
        Threading::{
            CreateEventW, OpenEventW, OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
            SYNCHRONIZATION_SYNCHRONIZE, SetEvent, WaitForSingleObject,
        },
    },
};

pub fn same_env_name(name: &OsStr, key: &str) -> bool {
    let name: Vec<_> = name.encode_wide().collect();
    let key: Vec<_> = OsStr::new(key).encode_wide().collect();
    unsafe {
        CompareStringOrdinal(
            name.as_ptr(),
            name.len() as i32,
            key.as_ptr(),
            key.len() as i32,
            1,
        ) == CSTR_EQUAL
    }
}

pub fn protect_stdio() -> Result<()> {
    // Command duplicates the requested stdio; the originals must not leak into descendants.
    for handle in [
        std::io::stdin().as_raw_handle(),
        std::io::stdout().as_raw_handle(),
        std::io::stderr().as_raw_handle(),
    ] {
        if !handle.is_null()
            && handle != INVALID_HANDLE_VALUE
            && unsafe { SetHandleInformation(handle, HANDLE_FLAG_INHERIT, 0) } == 0
        {
            return Err(std::io::Error::last_os_error())
                .context("Failed to protect relay stdio handles");
        }
    }
    Ok(())
}

fn wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}

fn owned(handle: HANDLE) -> Result<OwnedHandle> {
    if handle.is_null() {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(unsafe { OwnedHandle::from_raw_handle(handle) })
}

pub struct ProcessTree {
    job: OwnedHandle,
    event: OwnedHandle,
    pub event_name: OsString,
}

impl ProcessTree {
    pub fn new() -> Result<Self> {
        let job = owned(unsafe { CreateJobObjectW(null(), null()) })
            .context("Failed to create command job")?;
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { zeroed() };
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if unsafe {
            SetInformationJobObject(
                job.as_raw_handle(),
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        } == 0
        {
            return Err(std::io::Error::last_os_error()).context("Failed to configure command job");
        }
        static NEXT_EVENT: AtomicU64 = AtomicU64::new(0);
        let event_name = OsString::from(format!(
            "Local\\markdown-e2e-{}-{}",
            std::process::id(),
            NEXT_EVENT.fetch_add(1, Ordering::Relaxed)
        ));
        let event = unsafe { CreateEventW(null(), 1, 0, wide(&event_name).as_ptr()) };
        let existing = unsafe { GetLastError() } == ERROR_ALREADY_EXISTS;
        let event = owned(event).context("Failed to create command startup event")?;
        if existing {
            bail!("Command startup event already exists");
        }
        Ok(Self {
            job,
            event,
            event_name,
        })
    }

    pub fn start(&self, pid: u32) -> Result<()> {
        let process = owned(unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid) })
            .context("Failed to open command process")?;
        if unsafe { AssignProcessToJobObject(self.job.as_raw_handle(), process.as_raw_handle()) }
            == 0
        {
            return Err(std::io::Error::last_os_error()).context("Failed to assign command to job");
        }
        // The relay cannot spawn the tested command until job ownership is established.
        if unsafe { SetEvent(self.event.as_raw_handle()) } == 0 {
            return Err(std::io::Error::last_os_error())
                .context("Failed to release command startup");
        }
        Ok(())
    }

    pub fn terminate(&self) -> Result<()> {
        if unsafe { TerminateJobObject(self.job.as_raw_handle(), 1) } == 0 {
            return Err(std::io::Error::last_os_error()).context("Failed to terminate command job");
        }
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let mut info: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { zeroed() };
            if unsafe {
                QueryInformationJobObject(
                    self.job.as_raw_handle(),
                    JobObjectBasicAccountingInformation,
                    (&mut info as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(),
                    size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                    null_mut(),
                )
            } == 0
            {
                return Err(std::io::Error::last_os_error()).context("Failed to query command job");
            }
            if info.ActiveProcesses == 0 {
                return Ok(());
            }
            if Instant::now() >= deadline {
                bail!("Timed out waiting for command job to terminate");
            }
            thread::sleep(Duration::from_millis(10));
        }
    }
}

pub fn wait_for_start(name: &OsStr) -> Result<()> {
    let event = owned(unsafe { OpenEventW(SYNCHRONIZATION_SYNCHRONIZE, 0, wide(name).as_ptr()) })
        .context("Failed to open command startup event")?;
    match unsafe { WaitForSingleObject(event.as_raw_handle(), 30_000) } {
        WAIT_OBJECT_0 => Ok(()),
        windows_sys::Win32::Foundation::WAIT_FAILED => {
            Err(std::io::Error::last_os_error()).context("Failed waiting for command startup")
        }
        status => bail!("Command startup wait failed: {status}"),
    }
}
