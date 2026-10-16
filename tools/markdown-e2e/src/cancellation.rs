use anyhow::Result;

#[cfg(unix)]
use std::sync::{
    Arc, OnceLock,
    atomic::{AtomicUsize, Ordering},
};

#[cfg(unix)]
static SIGNAL: OnceLock<Arc<AtomicUsize>> = OnceLock::new();

pub fn install() -> Result<()> {
    #[cfg(unix)]
    {
        let flag = SIGNAL.get_or_init(|| Arc::new(AtomicUsize::new(0)));
        for signal in [libc::SIGINT, libc::SIGTERM] {
            signal_hook::flag::register_usize(signal, Arc::clone(flag), signal as usize)?;
        }
    }
    Ok(())
}

pub fn signal() -> Option<i32> {
    #[cfg(unix)]
    if let Some(flag) = SIGNAL.get() {
        let signal = flag.load(Ordering::Relaxed);
        if signal != 0 {
            return Some(signal as i32);
        }
    }
    None
}

pub fn check() -> Result<()> {
    if let Some(signal) = signal() {
        anyhow::bail!("Interrupted by signal {signal}");
    }
    Ok(())
}
