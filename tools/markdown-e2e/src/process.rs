use crate::{cancellation, matching::strip_ansi, spec};
use anyhow::{Context, Result, bail};
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::{
    collections::BTreeMap,
    ffi::OsString,
    io::{Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::{
        Arc, Mutex,
        mpsc::{self, Receiver},
    },
    thread,
    time::{Duration, Instant},
};

pub type Environment = BTreeMap<OsString, OsString>;

pub fn set_env(env: &mut Environment, key: &str, value: impl Into<OsString>) {
    #[cfg(windows)]
    env.retain(|name, _| !crate::windows::same_env_name(name, key));
    env.insert(key.into(), value.into());
}

#[derive(Debug)]
pub struct Output {
    pub text: String,
    pub code: i32,
}

#[cfg(windows)]
fn executable(program: &str, cwd: &Path, env: &Environment) -> Result<std::path::PathBuf> {
    let get_env = |key: &str| {
        env.iter()
            .find(|(name, _)| crate::windows::same_env_name(name, key))
            .map(|(_, value)| value)
    };
    let path = std::path::PathBuf::from(program);
    let dirs = if path.components().count() > 1 || path.is_absolute() {
        vec![cwd.to_owned()]
    } else {
        std::iter::once(cwd.to_owned())
            .chain(std::env::split_paths(
                get_env("PATH").context("PATH is not set")?,
            ))
            .collect()
    };
    let extensions = get_env("PATHEXT")
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".to_owned());
    for dir in dirs {
        let candidate = dir.join(&path);
        if path.extension().is_some() && candidate.is_file() {
            return Ok(candidate);
        }
        for extension in extensions.split(';').filter(|ext| !ext.is_empty()) {
            let mut candidate = candidate.as_os_str().to_owned();
            candidate.push(extension);
            let candidate = std::path::PathBuf::from(candidate);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }
    bail!("Executable not found on PATH: {program}");
}

#[cfg(windows)]
pub fn internal_exec() -> ! {
    let mut args = std::env::args_os().skip(2);
    let result = (|| {
        let event = args.next().context("Missing internal startup event")?;
        crate::windows::wait_for_start(&event)?;
        crate::windows::protect_stdio()?;
        let program = args.next().context("Missing internal executable")?;
        Ok::<_, anyhow::Error>(Command::new(program).args(args).status()?)
    })();
    match result {
        Ok(status) => std::process::exit(status.code().unwrap_or(1)),
        Err(error) => {
            eprintln!("Failed to execute command: {error:#}");
            std::process::exit(1);
        }
    }
}

fn read_pipe(mut reader: impl Read + Send + 'static) -> Receiver<std::io::Result<Vec<u8>>> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = reader.read_to_end(&mut bytes).map(|_| bytes);
        let _ = tx.send(result);
    });
    rx
}

#[cfg(unix)]
fn kill_group(pid: u32) -> Result<()> {
    let send = |signal| -> Result<()> {
        let result = unsafe { libc::kill(-(pid as i32), signal) };
        if result != 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(libc::ESRCH) {
                return Err(error.into());
            }
        }
        Ok(())
    };
    if let Some(signal) = cancellation::signal() {
        send(signal)?;
        thread::sleep(Duration::from_millis(100));
    }
    // Descendants can outlive the command and keep its output pipes open.
    send(libc::SIGKILL)
}

pub fn run(
    args: &[String],
    cwd: &Path,
    env: &Environment,
    input: Option<Vec<u8>>,
    timeout: Duration,
) -> Result<Output> {
    cancellation::check()?;
    let program = args.first().context("Empty command in pipeline stage")?;
    #[cfg(windows)]
    let program =
        executable(program, cwd, env).with_context(|| format!("Failed to start {program}"))?;
    #[cfg(windows)]
    let tree = crate::windows::ProcessTree::new()?;
    #[cfg(windows)]
    let mut command = {
        let mut command = Command::new(std::env::current_exe()?);
        command.args([
            OsString::from("--internal-exec"),
            tree.event_name.clone(),
            program.clone().into_os_string(),
        ]);
        command
    };
    #[cfg(not(windows))]
    let mut command = Command::new(program);
    command
        .args(&args[1..])
        .current_dir(cwd)
        .env_clear()
        .envs(env)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .spawn()
        .with_context(|| format!("Failed to start {program:?}"))?;
    #[cfg(windows)]
    if let Err(error) = tree.start(child.id()) {
        child
            .kill()
            .context("Failed to terminate command after startup failure")?;
        child
            .wait()
            .context("Failed to reap command after startup failure")?;
        return Err(error);
    }
    let terminate = |child: &mut Child| -> Result<()> {
        #[cfg(unix)]
        kill_group(child.id())?;
        #[cfg(windows)]
        tree.terminate()?;
        child.wait()?;
        Ok(())
    };
    let stdout = read_pipe(child.stdout.take().context("Missing stdout pipe")?);
    let stderr = read_pipe(child.stderr.take().context("Missing stderr pipe")?);
    let mut stdin = child.stdin.take().context("Missing stdin pipe")?;
    let (input_tx, input_rx) = mpsc::channel();
    thread::spawn(move || {
        let result = if let Some(input) = input {
            stdin.write_all(&input)
        } else {
            Ok(())
        };
        drop(stdin);
        let _ = input_tx.send(result);
    });
    let mut terminated = false;
    let result = (|| {
        let start = Instant::now();
        let status = loop {
            cancellation::check()?;
            if let Some(status) = child.try_wait()? {
                break status;
            }
            if start.elapsed() >= timeout {
                terminate(&mut child)?;
                terminated = true;
                let out = stdout
                    .recv_timeout(Duration::from_secs(1))
                    .ok()
                    .transpose()?;
                let err = stderr
                    .recv_timeout(Duration::from_secs(1))
                    .ok()
                    .transpose()?;
                bail!(
                    "Command timed out after {}ms: {}\nOutput so far:\n{}{}",
                    timeout.as_millis(),
                    args.join(" "),
                    String::from_utf8_lossy(&out.unwrap_or_default()),
                    String::from_utf8_lossy(&err.unwrap_or_default())
                );
            }
            thread::sleep(Duration::from_millis(10));
        };
        let collect = |rx: Receiver<std::io::Result<Vec<u8>>>| -> Result<Vec<u8>> {
            loop {
                cancellation::check()?;
                match rx.recv_timeout(Duration::from_millis(10)) {
                    Ok(result) => return Ok(result?),
                    Err(mpsc::RecvTimeoutError::Timeout) if start.elapsed() < timeout => {}
                    Err(error) => {
                        bail!("Timed out draining command output: {error}");
                    }
                }
            }
        };
        let stdout = collect(stdout)?;
        let stderr = collect(stderr)?;
        let input_result = loop {
            cancellation::check()?;
            match input_rx.recv_timeout(Duration::from_millis(10)) {
                Ok(result) => break result,
                Err(mpsc::RecvTimeoutError::Timeout) if start.elapsed() < timeout => {}
                Err(error) => bail!("Failed waiting for stdin writer: {error}"),
            }
        };
        if let Err(error) = input_result
            && error.kind() != std::io::ErrorKind::BrokenPipe
        {
            return Err(error).context("Failed writing stdin");
        }
        let code = status.code().unwrap_or(1);
        let mut text = String::from_utf8_lossy(&stdout).into_owned();
        if code != 0 {
            text.push_str(&String::from_utf8_lossy(&stderr));
        }
        Ok(Output { text, code })
    })();
    if result.is_err() && !terminated {
        terminate(&mut child).context("Failed to clean up command process group")?;
    }
    #[cfg(windows)]
    if result.is_ok() {
        tree.terminate()?;
    }
    result
}

pub fn pty(
    args: &[String],
    cwd: &Path,
    env: &Environment,
    steps: &[spec::Step],
    timeout: Duration,
) -> Result<Output> {
    cancellation::check()?;
    let pair = native_pty_system().openpty(PtySize {
        rows: 30,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    })?;
    #[cfg(not(windows))]
    let argv = args.iter().map(OsString::from).collect();
    #[cfg(windows)]
    let tree = crate::windows::ProcessTree::new()?;
    #[cfg(windows)]
    let argv = {
        let program = executable(args.first().context("Empty PTY command")?, cwd, env)?;
        let mut argv = vec![
            std::env::current_exe()?.into_os_string(),
            "--internal-exec".into(),
            tree.event_name.clone(),
        ];
        argv.push(program.into_os_string());
        argv.extend(args.iter().skip(1).map(OsString::from));
        argv
    };
    let mut command = CommandBuilder::from_argv(argv);
    command.cwd(cwd);
    command.env_clear();
    for (key, value) in env {
        command.env(key, value);
    }
    command.env("TERM", "xterm-color");
    let mut reader = pair.master.try_clone_reader()?;
    let writer = Arc::new(Mutex::new(pair.master.take_writer()?));
    let (tx, rx) = mpsc::channel();
    #[cfg(windows)]
    let response_writer = Arc::clone(&writer);
    thread::spawn(move || {
        let mut buffer = [0; 8192];
        #[cfg(windows)]
        let mut queries = Vec::new();
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    #[cfg(windows)]
                    {
                        // ConPTY's INHERIT_CURSOR handshake can precede spawn completion.
                        queries.extend_from_slice(&buffer[..n]);
                        let result = (|| -> Result<()> {
                            for _ in queries.windows(4).filter(|bytes| *bytes == b"\x1b[6n") {
                                let mut writer = response_writer.lock().unwrap();
                                writer.write_all(b"\x1b[1;1R")?;
                                writer.flush()?;
                            }
                            Ok(())
                        })();
                        if let Err(error) = result {
                            let _ = tx.send(Err(std::io::Error::other(error)));
                            break;
                        }
                        queries.drain(..queries.len().saturating_sub(3));
                    }
                    if tx.send(Ok(buffer[..n].to_vec())).is_err() {
                        break;
                    }
                }
                // Linux PTYs return EIO when the slave closes.
                Err(error) if cfg!(unix) && error.raw_os_error() == Some(5) => break,
                Err(error) => {
                    let _ = tx.send(Err(error));
                    break;
                }
            }
        }
    });
    let mut child = pair.slave.spawn_command(command)?;
    #[cfg(windows)]
    if let Err(error) = tree.start(child.process_id().context("Missing PTY process ID")?) {
        child
            .kill()
            .context("Failed to terminate PTY after startup failure")?;
        child
            .wait()
            .context("Failed to reap PTY after startup failure")?;
        return Err(error);
    }
    drop(pair.slave);
    let mut master = Some(pair.master);
    let (send_tx, send_rx) = mpsc::channel::<Vec<u8>>();
    let (written_tx, written_rx) = mpsc::channel();
    thread::spawn(move || {
        for input in send_rx {
            let mut writer = writer.lock().unwrap();
            let result = writer.write_all(&input).and_then(|()| writer.flush());
            let failed = result.is_err();
            if written_tx.send(result).is_err() || failed {
                break;
            }
        }
    });
    let result = (|| {
        let mut bytes = Vec::new();
        let mut step_index = 0;
        let (mut raw_cursor, mut clean_cursor) = (0, 0);
        let start = Instant::now();
        let mut pending = None;
        let mut sending = false;
        let mut exited = None;
        let mut eof = false;
        loop {
            cancellation::check()?;
            match rx.recv_timeout(Duration::from_millis(10)) {
                Ok(chunk) => bytes.extend(chunk.context("Failed reading PTY output")?),
                Err(mpsc::RecvTimeoutError::Disconnected) => eof = true,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
            let raw = String::from_utf8_lossy(&bytes);
            let clean = strip_ansi(&raw);
            if start.elapsed() >= timeout {
                let waiting = steps.get(step_index).map_or_else(
                    || "Waiting for process to exit (all steps matched)".to_owned(),
                    |step| format!("Waiting for step {step_index}: match {:?}", step.text),
                );
                bail!(
                    "PTY command timed out after {}ms.\n{waiting}\nOutput so far:\n{raw}",
                    timeout.as_millis()
                );
            }
            if sending {
                match written_rx.try_recv() {
                    Ok(result) => {
                        result.context("Failed writing PTY input")?;
                        step_index += 1;
                        sending = false;
                    }
                    Err(mpsc::TryRecvError::Empty) => {}
                    Err(error) => bail!("PTY input writer stopped: {error}"),
                }
            } else if let Some(send_at) = pending {
                if Instant::now() >= send_at && exited.is_none() {
                    send_tx.send(spec::input_keys(&steps[step_index].input).into_bytes())?;
                    sending = true;
                    pending = None;
                }
            } else if let Some(step) = steps.get(step_index) {
                let (haystack, cursor) = if step.raw {
                    (raw.as_ref(), &mut raw_cursor)
                } else {
                    (clean.as_str(), &mut clean_cursor)
                };
                if let Some(pos) = haystack.get(*cursor..).and_then(|s| s.find(&step.text)) {
                    *cursor += pos + step.text.len();
                    pending = Some(Instant::now() + Duration::from_millis(200));
                }
            }
            if exited.is_none() {
                exited = child.try_wait()?;
                if exited.is_some() {
                    #[cfg(windows)]
                    tree.terminate()?;
                    // Closing ConPTY releases its output pipe so the reader can drain to EOF.
                    drop(master.take());
                }
            }
            if let Some(status) = &exited
                && eof
                && !sending
            {
                if step_index < steps.len() {
                    bail!(
                        "PTY exited before completing step {step_index}: match {:?}\nOutput:\n{raw}",
                        steps[step_index].text
                    );
                }
                return Ok(Output {
                    text: clean,
                    code: status.exit_code() as i32,
                });
            }
        }
    })();
    #[cfg(windows)]
    tree.terminate()?;
    if result.is_err() {
        #[cfg(unix)]
        kill_group(child.process_id().context("Missing PTY process ID")?)?;
        if child.try_wait()?.is_none()
            && let Err(error) = child.kill()
            && child.try_wait()?.is_none()
        {
            return Err(error).context("Failed to terminate PTY command");
        }
        child.wait().context("Failed to reap PTY command")?;
    }
    result
}
