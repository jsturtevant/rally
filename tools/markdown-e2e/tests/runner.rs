use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
    sync::OnceLock,
    time::{Duration, Instant},
};
use tempfile::TempDir;

fn helper() -> &'static Path {
    static HELPER: OnceLock<(TempDir, PathBuf)> = OnceLock::new();
    &HELPER.get_or_init(|| {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("helper.rs");
        fs::write(&source, r#"
use std::{env, fs, io::{self, Read, Write}, thread, time::Duration};
fn main() {
    let args: Vec<_> = env::args().collect();
    if args.len() == 1 {
        fs::write(env::var("TEST_HOME").unwrap() + "/state", "ready").unwrap();
        return;
    }
    match args.get(1).map(String::as_str).unwrap_or("") {
        "echo" => println!("{}", args[2..].join(" ")),
        "fail" => { print!("stdout\n"); eprint!("stderr\n"); std::process::exit(2); }
        "cat" => { let mut s = String::new(); io::stdin().read_to_string(&mut s).unwrap(); print!("{s}"); }
        "setup" | "setup-other" => {
            assert!(std::path::Path::new(&args[2]).exists());
            let value = if args[1] == "setup" { "ready" } else { "other" };
            fs::write(env::var("TEST_HOME").unwrap() + "/state", value).unwrap();
        }
        "state" => println!("{}", fs::read_to_string(env::var("TEST_HOME").unwrap() + "/state").unwrap()),
        "vars" => {
            for key in ["TEST_HOME", "XDG_CONFIG_HOME", "GH_CONFIG_DIR"] { println!("{}", env::var(key).unwrap()); }
            println!("{}", env::current_dir().unwrap().display());
        }
        "gh-config" => println!("{}", env::var("GH_CONFIG_DIR").unwrap()),
        "root" => {
            assert_eq!(args[2], env::current_dir().unwrap().display().to_string());
            assert_eq!(args[3], "");
        }
        "mark" => fs::write(&args[2], "unexpected").unwrap(),
        "tree" | "drain" | "writer" => {
            let mut command = std::process::Command::new(env::current_exe().unwrap());
            command.arg("sleep");
            if args[1] == "writer" {
                command.stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null());
            }
            let child = command.spawn().unwrap();
            fs::write(&args[2], format!("{}\n{}\n{}\n{}", std::process::id(), child.id(), env::var("TEST_HOME").unwrap(), env::var("XDG_CONFIG_HOME").unwrap())).unwrap();
            if args[1] == "tree" { thread::sleep(Duration::from_secs(60)); }
        }
        "sleep" => { println!("before timeout"); thread::sleep(Duration::from_secs(10)); }
        "interactive" => {
            print!("\x1b[?25l"); io::stdout().flush().unwrap();
            // Exercise split ANSI and UTF-8 reads.
            io::stdout().write_all(b"\x1b[").unwrap(); io::stdout().flush().unwrap();
            thread::sleep(Duration::from_millis(30));
            print!("31mReady?\x1b[0m"); io::stdout().flush().unwrap();
            let mut answer = String::new(); io::stdin().read_line(&mut answer).unwrap();
            println!("accepted {}", answer.trim());
            print!("Ready?"); io::stdout().flush().unwrap();
            answer.clear(); io::stdin().read_line(&mut answer).unwrap();
            println!("done {}", answer.trim());
        }
        "premature" => println!("done"),
        "auth" => {}
        "repo" => {
            assert_eq!(&args[2], "clone");
            fs::write(std::path::Path::new(&args[4]).join("cloned"), "yes").unwrap();
        }
        "cloned" => println!("{}", fs::read_to_string("cloned").unwrap()),
        "bulk" => { let bytes = vec![b'x'; 256 * 1024]; io::stdout().write_all(&bytes).unwrap(); io::stderr().write_all(&bytes).unwrap(); }
        _ => panic!("unknown helper arguments {args:?}"),
    }
}
"#).unwrap();
        let binary = dir.path().join(format!("app{}", std::env::consts::EXE_SUFFIX));
        let output = Command::new("rustc").arg("--edition=2024").arg(&source).arg("-o").arg(&binary).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        (dir, binary)
    }).1
}

fn command(specs: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_markdown-e2e"));
    let path = std::env::join_paths(
        std::iter::once(helper().parent().unwrap().to_owned())
            .chain(std::env::split_paths(&std::env::var_os("PATH").unwrap())),
    )
    .unwrap();
    command
        .arg(specs)
        .args(["--home-env", "TEST_HOME"])
        .env("PATH", path)
        .env("GH_CONFIG_DIR", specs.join("real-gh-config"))
        .env_remove("E2E_FILE_PATTERN")
        .env_remove("E2E_FILE_EXCLUDE")
        .env_remove("E2E_TAGS")
        .env_remove("E2E_TAGS_EXCLUDE")
        .env_remove("VERBOSE");
    command
}

fn text(output: &Output) -> String {
    format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

#[test]
fn standalone_sequential_setup_variables_pipeline_and_nonzero_exit() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("setup.fixture"), "").unwrap();
    fs::write(
        dir.path().join("test.md"),
        r#"---
setup: app setup setup.fixture
---
## `app state`
```expected
ready
```
## `app echo "hello | world" "" | app cat`
```expected
hello | world
```
## `app cat`
```stdin
input
```
```expected
input
```
## `app fail | app echo must-not-run` (exit 2)
```expected
stdout
stderr
```
## `app echo $TEST_HOME $REPO_ROOT $PROJECT_NAME $XDG_CONFIG_HOME`
```expected
$TEST_HOME $REPO_ROOT $PROJECT_NAME $XDG_CONFIG_HOME
```
## `app vars`
```expected
$TEST_HOME
$XDG_CONFIG_HOME
"#
        .to_owned()
            + &dir.path().join("real-gh-config").display().to_string()
            + r#"
$REPO_ROOT
```
## `app bulk`
"#,
    )
    .unwrap();
    let output = command(dir.path()).output().unwrap();
    assert!(output.status.success(), "{}", text(&output));
    assert!(text(&output).contains("pass 7"), "{}", text(&output));
}

#[test]
fn each_file_chooses_its_own_setup_command() {
    let dir = tempfile::Builder::new()
        .prefix("markdown e2e ")
        .tempdir()
        .unwrap();
    let executable = format!("setup tool{}", std::env::consts::EXE_SUFFIX);
    fs::hard_link(helper(), dir.path().join(&executable)).unwrap();
    fs::write(dir.path().join("setup.fixture"), "").unwrap();
    fs::write(
        dir.path().join("a.md"),
        format!("---\nsetup: '\"{executable}\" setup setup.fixture'\n---\n## `app state`\n```expected\nready\n```\n"),
    ).unwrap();
    fs::write(
        dir.path().join("b.md"),
        "---\nsetup: app setup-other setup.fixture\n---\n## `app state`\n```expected\nother\n```\n",
    )
    .unwrap();
    let output = command(dir.path()).output().unwrap();
    assert!(output.status.success(), "{}", text(&output));
    assert!(text(&output).contains("pass 2"), "{}", text(&output));
}

#[test]
fn setup_runner_flag_is_no_longer_supported() {
    let dir = tempfile::tempdir().unwrap();
    let output = command(dir.path())
        .args(["--setup-runner", "app"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(
        text(&output).contains("unexpected argument '--setup-runner'"),
        "{}",
        text(&output)
    );
}

#[test]
fn setup_executes_directly_without_a_node_interpreter() {
    let dir = tempfile::Builder::new()
        .prefix("markdown e2e ")
        .tempdir()
        .unwrap();
    let name = format!("setup{}", std::env::consts::EXE_SUFFIX);
    fs::hard_link(helper(), dir.path().join(&name)).unwrap();
    fs::write(
        dir.path().join("direct.md"),
        format!("---\nsetup: {name}\n---\n## `app state`\n```expected\nready\n```\n"),
    )
    .unwrap();
    let output = command(dir.path())
        .env("PATH", helper().parent().unwrap())
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", text(&output));
}

#[cfg(windows)]
#[test]
fn windows_batch_shims_work_in_pipes_and_ptys() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("shim.cmd"),
        format!("@echo off\r\n\"{}\" %*\r\n", helper().display()),
    )
    .unwrap();
    fs::write(
        dir.path().join("shim.md"),
        r#"## `shim echo "hello & world"`
```expected
hello & world
```
## `shim interactive`
```pty
match: Ready?
send: yes{enter}
match: Ready?
send: no{enter}
```
```expected
done no
```
"#,
    )
    .unwrap();
    let path = std::env::join_paths(
        [dir.path().to_owned(), helper().parent().unwrap().to_owned()]
            .into_iter()
            .chain(std::env::split_paths(&std::env::var_os("PATH").unwrap())),
    )
    .unwrap();
    let output = command(dir.path()).env("PATH", path).output().unwrap();
    assert!(output.status.success(), "{}", text(&output));
}

#[test]
fn recursive_discovery_tags_files_and_name_filter_failures() {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("nested")).unwrap();
    fs::write(
        dir.path().join("nested/slow.md"),
        "---\ntags: [Dispatch, SLOW]\n---\n## `app fail`\n",
    )
    .unwrap();
    fs::write(dir.path().join("fast.md"), "## `app echo fast`\n").unwrap();
    let output = command(dir.path())
        .env("E2E_TAGS_EXCLUDE", "SLOW")
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", text(&output));
    assert!(!text(&output).contains("nested/slow.md"));
    let output = command(dir.path())
        .args(["--tags", "dispatch,slow", "--list"])
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(text(&output).contains("nested/slow.md"));
    assert!(!text(&output).contains("fast.md"));
    let output = command(dir.path())
        .args([
            "--file-pattern",
            "^nested/",
            "--test-name-pattern",
            "slow.md",
        ])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(text(&output).contains("fail 1"));
    let output = command(dir.path())
        .args(["--test-name-pattern", "app fail"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let output = command(dir.path())
        .args(["--file-exclude", "nested", "--test-name-pattern", "fast"])
        .output()
        .unwrap();
    assert!(output.status.success());
    let output = command(dir.path())
        .args(["--file-pattern", "missing"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(text(&output).contains("No markdown test specs matched"));
}

#[test]
fn timeouts_are_not_expected_exit_failures() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("timeout.md"),
        "---\ntimeout: 0.15\n---\n## `app sleep` (exit 1)\n",
    )
    .unwrap();
    let start = Instant::now();
    let output = command(dir.path()).output().unwrap();
    assert!(!output.status.success());
    assert!(text(&output).contains("timed out"), "{}", text(&output));
    assert!(text(&output).contains("before timeout"));
    assert!(start.elapsed() < Duration::from_secs(5));
}

#[test]
fn pty_raw_clean_repeated_prompts_and_missing_steps() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("interactive.md"),
        r#"## `app interactive`
```pty
match-raw: {hide-cursor}
send:
match: Ready?
send: yes{enter}
match: Ready?
send: no{enter}
```
```expected
done no
```
"#,
    )
    .unwrap();
    let output = command(dir.path()).output().unwrap();
    assert!(output.status.success(), "{}", text(&output));
    fs::write(
        dir.path().join("interactive.md"),
        "## `app premature`\n```pty\nmatch: missing\nsend: y\n```\n",
    )
    .unwrap();
    let output = command(dir.path()).output().unwrap();
    assert!(!output.status.success());
    assert!(
        text(&output).contains("before completing step"),
        "{}",
        text(&output)
    );
    fs::write(
        dir.path().join("interactive.md"),
        "---\ntimeout: 0.1\n---\n## `app sleep`\n```pty\nmatch: missing\nsend: y\n```\n",
    )
    .unwrap();
    let output = command(dir.path()).output().unwrap();
    assert!(!output.status.success());
    assert!(
        text(&output).contains("PTY command timed out"),
        "{}",
        text(&output)
    );
}

#[test]
fn invalid_setup_spawn_empty_specs_and_mismatches_fail() {
    let dir = tempfile::tempdir().unwrap();
    for (markdown, expected) in [
        ("# no commands", "No test cases found"),
        ("---\ntags: nope\n---\n", "tags must be an array"),
        (
            "## `missing-executable-markdown-e2e` (exit 1)",
            "Failed to start",
        ),
        (
            "## `app echo actual`\n```expected\nexpected\n```\n",
            "Line 1 mismatch",
        ),
        (
            "---\nsetup: missing\n---\n## `app echo ignored`",
            "Setup command failed",
        ),
        (
            "---\nsetup: missing-executable-markdown-e2e setup.fixture\n---\n## `app echo ignored`",
            "Setup command failed",
        ),
        (
            "---\nsetup: app fail\n---\n## `app echo ignored`",
            "Setup command failed: app fail",
        ),
    ] {
        fs::write(dir.path().join("test.md"), markdown).unwrap();
        let output = command(dir.path()).output().unwrap();
        assert!(!output.status.success(), "{markdown}");
        assert!(text(&output).contains(expected), "{}", text(&output));
    }
}

#[test]
fn clone_fixture_is_isolated_and_removed() {
    let dir = tempfile::tempdir().unwrap();
    let gh = dir
        .path()
        .join(format!("gh{}", std::env::consts::EXE_SUFFIX));
    fs::hard_link(helper(), &gh).unwrap();
    fs::write(dir.path().join("clone.md"), "---\nclone: owner/repo\n---\n## `app cloned`\n```expected\nyes\n```\n## `app echo $REPO_ROOT`\n").unwrap();
    let path = std::env::join_paths(
        [dir.path().to_owned(), helper().parent().unwrap().to_owned()]
            .into_iter()
            .chain(std::env::split_paths(&std::env::var_os("PATH").unwrap())),
    )
    .unwrap();
    let output = command(dir.path())
        .env("PATH", path)
        .arg("--verbose")
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", text(&output));
    let text = text(&output);
    let cloned = text
        .lines()
        .find(|line| line.contains("markdown-e2e-repo-") && !line.contains("PASS"))
        .unwrap();
    assert!(
        !Path::new(cloned).exists(),
        "cloned fixture was not cleaned up: {cloned}"
    );
}

#[test]
fn empty_authentication_environment_values_use_nonempty_fallbacks() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path().join("home");
    for (key, expected) in [
        ("XDG_CONFIG_HOME", home.join("gh")),
        ("HOME", home.join(".config/gh")),
        ("USERPROFILE", home.join(".config/gh")),
        #[cfg(windows)]
        ("APPDATA", home.join("GitHub CLI")),
    ] {
        fs::write(
            dir.path().join("config.md"),
            format!(
                "## `app gh-config`\n```expected\n{}\n```\n",
                expected.display()
            ),
        )
        .unwrap();
        let output = command(dir.path())
            .env("GH_CONFIG_DIR", "")
            .env("XDG_CONFIG_HOME", "")
            .env("APPDATA", "")
            .env("HOME", "")
            .env("USERPROFILE", "")
            .env(key, &home)
            .output()
            .unwrap();
        assert!(output.status.success(), "{key}: {}", text(&output));
    }
}

#[test]
fn listing_needs_neither_authentication_nor_a_working_directory() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("list.md"),
        "---\nclone: owner/repo\nsetup: nonexistent\n---\n## `app echo listed`\n",
    )
    .unwrap();
    let output = command(dir.path())
        .args(["--list", "--cwd"])
        .arg(dir.path().join("nonexistent"))
        .env_remove("GH_CONFIG_DIR")
        .env_remove("XDG_CONFIG_HOME")
        .env_remove("APPDATA")
        .env_remove("HOME")
        .env_remove("USERPROFILE")
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", text(&output));
    assert!(text(&output).contains("app echo listed"));
}

#[test]
fn filesystem_root_is_a_valid_working_directory() {
    let dir = tempfile::tempdir().unwrap();
    let cwd = dunce::canonicalize(std::env::current_dir().unwrap()).unwrap();
    let root: PathBuf = cwd
        .components()
        .take_while(|part| !matches!(part, std::path::Component::Normal(_)))
        .collect();
    fs::write(
        dir.path().join("root.md"),
        "## `app root \"$REPO_ROOT\" \"$PROJECT_NAME\"`\n",
    )
    .unwrap();
    let output = command(dir.path()).arg("--cwd").arg(root).output().unwrap();
    assert!(output.status.success(), "{}", text(&output));
}

#[cfg(unix)]
#[test]
fn interrupts_reap_commands_stop_descendants_and_clean_up_fixtures() {
    for signal in [libc::SIGINT, libc::SIGTERM] {
        for mode in ["command", "setup", "pty", "drain", "writer"] {
            let dir = tempfile::tempdir().unwrap();
            let started = dir.path().join("started");
            let later = dir.path().join("later");
            let tree = format!(
                "app {} \"{}\"",
                if ["drain", "writer"].contains(&mode) {
                    mode
                } else {
                    "tree"
                },
                started.display()
            );
            let markdown = match mode {
                "setup" => format!(
                    "---\nsetup: '{tree}'\n---\n## `app mark \"{}\"`\n",
                    later.display()
                ),
                "pty" => format!(
                    "## `{tree}`\n```pty\nmatch: never\nsend: y\n```\n## `app mark \"{}\"`\n",
                    later.display()
                ),
                "writer" => format!(
                    "## `{tree}`\n```stdin\n{}\n```\n## `app mark \"{}\"`\n",
                    "x".repeat(256 * 1024),
                    later.display()
                ),
                _ => format!("## `{tree}`\n## `app mark \"{}\"`\n", later.display()),
            };
            fs::write(dir.path().join("a.md"), markdown).unwrap();
            fs::write(
                dir.path().join("b.md"),
                format!("## `app mark \"{}\"`\n", later.display()),
            )
            .unwrap();
            let mut runner = command(dir.path())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .unwrap();
            let deadline = Instant::now() + Duration::from_secs(5);
            while !started.exists() && Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(10));
            }
            if !started.exists() {
                runner.kill().unwrap();
                panic!(
                    "Helper did not start: {}",
                    text(&runner.wait_with_output().unwrap())
                );
            }
            let info = fs::read_to_string(&started).unwrap();
            let info: Vec<_> = info.lines().collect();
            if ["drain", "writer"].contains(&mode) {
                let pid: i32 = info[0].parse().unwrap();
                let deadline = Instant::now() + Duration::from_secs(5);
                while unsafe { libc::kill(pid, 0) } == 0 && Instant::now() < deadline {
                    std::thread::sleep(Duration::from_millis(10));
                }
                assert_eq!(
                    unsafe { libc::kill(pid, 0) },
                    -1,
                    "Command did not exit before cancellation"
                );
            }
            assert_eq!(unsafe { libc::kill(runner.id() as i32, signal) }, 0);
            let deadline = Instant::now() + Duration::from_secs(5);
            while runner.try_wait().unwrap().is_none() && Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(10));
            }
            if runner.try_wait().unwrap().is_none() {
                runner.kill().unwrap();
                panic!(
                    "Runner did not cancel: {}",
                    text(&runner.wait_with_output().unwrap())
                );
            }
            let output = runner.wait_with_output().unwrap();
            assert_eq!(
                output.status.code(),
                Some(128 + signal),
                "{mode}: {}",
                text(&output)
            );
            for pid in &info[..2] {
                let pid: i32 = pid.parse().unwrap();
                let stopped = unsafe { libc::kill(pid, 0) } == -1;
                #[cfg(target_os = "linux")]
                let stopped = stopped
                    || fs::read_to_string(format!("/proc/{pid}/stat")).is_ok_and(|stat| {
                        stat.split(") ")
                            .nth(1)
                            .is_some_and(|state| state.starts_with('Z'))
                    });
                assert!(stopped, "{mode}: process {pid} survived cancellation");
            }
            for path in &info[2..] {
                assert!(
                    !Path::new(path).exists(),
                    "{mode}: fixture {path} was not cleaned up"
                );
            }
            assert!(
                !later.exists(),
                "{mode}: execution continued after cancellation"
            );
        }
    }
}
