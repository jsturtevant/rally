use super::*;

#[test]
fn environment_overrides_follow_platform_case_rules() {
    for (inherited, key) in [
        ("test_home", "TEST_HOME"),
        ("\u{e9}2e_home", "\u{c9}2E_HOME"),
    ] {
        let mut env = process::Environment::from([(inherited.into(), "caller".into())]);
        process::set_env(&mut env, key, "fixture");
        assert_eq!(env.get(std::ffi::OsStr::new(key)).unwrap(), "fixture");
        #[cfg(windows)]
        assert_eq!(env.len(), 1);
        #[cfg(not(windows))]
        assert_eq!(env.get(std::ffi::OsStr::new(inherited)).unwrap(), "caller");
    }
}

#[test]
fn frontmatter_and_tags() -> Result<()> {
    let spec = spec::parse(
        "---\r\nclone: owner/repo\r\nsetup: node setup.js\r\ntags: [Dispatch, SLOW, slow]\r\ntimeout: '0.5'\r\n---\r\n## `cmd` (exit 2)\r\n",
    )?;
    assert_eq!(spec.clone.as_deref(), Some("owner/repo"));
    assert_eq!(spec.setup.as_deref(), Some("node setup.js"));
    assert_eq!(spec.tags, ["dispatch", "slow"]);
    assert_eq!(spec.timeout, Some(Duration::from_millis(500)));
    assert_eq!(spec.cases[0].exit_code, 2);
    for invalid in [
        "[]",
        "42",
        "tags: null",
        "tags: slow",
        "tags: [42]",
        "tags: [' ']",
        "timeout: 0",
        "timeout: -1",
        "timeout: .inf",
        "timeout: nope",
        "setup: []",
        "setup: ''",
        "setup: '   '",
        "setup: '\"\"'",
    ] {
        assert!(
            spec::parse(&format!("---\n{invalid}\n---\n")).is_err(),
            "{invalid}"
        );
    }
    assert!(spec::parse("---\n\n---\n")?.cases.is_empty());
    assert!(spec::parse("# Title")?.tags.is_empty());
    Ok(())
}

#[test]
fn setup_commands_resolve_files_without_assuming_an_interpreter() -> Result<()> {
    let dir = tempfile::tempdir()?;
    fs::write(dir.path().join("setup script.py"), "")?;
    assert_eq!(
        resolve_setup(
            "python3 -I 'setup script.py' --name 'two words' ''",
            dir.path()
        )?,
        vec![
            "python3".to_owned(),
            "-I".into(),
            dir.path()
                .join("setup script.py")
                .to_string_lossy()
                .into_owned(),
            "--name".into(),
            "two words".into(),
            "".into(),
        ]
    );
    assert_eq!(
        resolve_setup("custom ./missing.py ../shared.py", dir.path())?,
        vec![
            "custom".to_owned(),
            dir.path()
                .join("./missing.py")
                .to_string_lossy()
                .into_owned(),
            dir.path()
                .join("../shared.py")
                .to_string_lossy()
                .into_owned(),
        ]
    );
    assert!(resolve_setup("", dir.path()).is_err());
    assert!(resolve_setup("''", dir.path()).is_err());
    Ok(())
}

#[test]
fn parses_all_blocks_and_smoke_tests() -> Result<()> {
    let spec = spec::parse(
        "## `cmd a` (exit 1)\nprose\n```expected-contains\nerror\n```\n```stdin\ny\n```\n\
         ## `cmd b`\n```pty\nmatch: Create?\nsend: y{enter}\n\nmatch-raw: {hide-cursor}\nsend: q\n```\n\
         ```expected\ndone\n```\n## `cmd c`\nSmoke.\n",
    )?;
    assert_eq!(spec.cases.len(), 3);
    let first = &spec.cases[0];
    assert_eq!(first.command, "cmd a");
    assert_eq!(first.expected.as_deref(), Some("error"));
    assert_eq!(first.stdin.as_deref(), Some("y\n"));
    assert_eq!(first.exit_code, 1);
    assert!(first.contains);
    let second = &spec.cases[1];
    let steps = second.pty.as_ref().unwrap();
    assert!(!steps[0].raw);
    assert_eq!(steps[0].input, "y{enter}");
    assert!(steps[1].raw);
    assert_eq!(steps[1].text, "\x1b[?25l");
    assert_eq!(second.expected.as_deref(), Some("done"));
    assert!(!second.contains);
    assert!(spec.cases[2].expected.is_none());
    for block in ["send: y", "match: prompt", "match-raw: \\x1b[2J"] {
        assert!(spec::parse(&format!("## `cmd`\n```pty\n{block}\n```")).is_err());
    }
    Ok(())
}

#[test]
fn key_placeholders_and_ansi() {
    assert_eq!(
        spec::raw_keys("{HIDE-CURSOR}{show-cursor}{clear-screen}{alt-screen}\\x1b[2J"),
        "\x1b[?25l\x1b[?25h\x1b[2J\x1b[?1049h\x1b[2J"
    );
    assert_eq!(
        spec::input_keys("a{ENTER}{up}{Down}{space}{backspace}"),
        "a\r\x1b[A\x1b[B \x7f"
    );
    assert_eq!(
        matching::strip_ansi("\x1b[31mred\x1b[0m\x1b[?25l\x1b]0;title\x07"),
        "red"
    );
}

#[test]
fn tokenization_matches_original_runner() {
    for (input, expected) in [
        ("rally --help", vec!["rally", "--help"]),
        (
            "grep -c 'Total session time:'",
            vec!["grep", "-c", "Total session time:"],
        ),
        ("echo \"hello world\"", vec!["echo", "hello world"]),
        (
            "grep \"foo bar\" 'baz qux'",
            vec!["grep", "foo bar", "baz qux"],
        ),
        ("  rally  ", vec!["rally"]),
        ("echo \"hello", vec!["echo", "hello"]),
        ("", vec![]),
        ("cmd \"\" --flag", vec!["cmd", "", "--flag"]),
        ("cmd ''", vec!["cmd", ""]),
        (r"cmd C:\some\path", vec!["cmd", r"C:\some\path"]),
    ] {
        assert_eq!(spec::split_command(input), expected, "{input}");
    }
    for (input, expected) in [
        ("echo hello|grep hello", vec!["echo hello", "grep hello"]),
        ("cmd1  |  cmd2", vec!["cmd1", "cmd2"]),
        ("rally --help", vec!["rally --help"]),
        ("| cmd1 || cmd2 |", vec!["cmd1", "cmd2"]),
        ("grep -E 'a|b' file", vec!["grep -E 'a|b' file"]),
        ("echo \"a|b\" | wc -c", vec!["echo \"a|b\"", "wc -c"]),
        ("a|b|c", vec!["a", "b", "c"]),
    ] {
        assert_eq!(spec::split_pipeline(input), expected, "{input}");
    }
}

#[test]
fn normalization_and_wrapping() {
    for (actual, expected) in [
        ("  hello   world  ", "hello world"),
        ("a\n\nb\n\n", "a\nb"),
        (r"path\to\\file", "path/to/file"),
        ("hello\nworld", "hello world"),
        ("hello\nworld", "helloworld"),
        ("a\nb\nc", "a b c"),
        ("hello\nworld", "hello\nworld"),
    ] {
        matching::check(actual, expected, false).unwrap();
    }
}

#[test]
fn exact_and_contains_failures() {
    for (actual, expected, message) in [
        ("actual", "expected", "Line 1 mismatch"),
        ("a\nb", "a", "Extra actual line"),
        ("a", "a\nb", "Missing expected line"),
    ] {
        assert!(
            matching::check(actual, expected, false)
                .unwrap_err()
                .to_string()
                .contains(message)
        );
    }
    matching::check("noise\na\nnoise\nb", "a\nb", true).unwrap();
    matching::check("", "", true).unwrap();
    for (actual, expected, message) in [
        ("a\nc", "a\nb", "Expected line 2 not found"),
        ("noise\na\ntrailing", "a", "unmatched trailing line"),
        ("b\na", "a\nb", "Expected line 2 not found"),
        ("noise", "", "unmatched trailing line"),
        ("prefix a", "a", "Expected line 1 not found"),
    ] {
        assert!(
            matching::check(actual, expected, true)
                .unwrap_err()
                .to_string()
                .contains(message)
        );
    }
}

#[test]
fn commands_use_path_and_script_resolution_is_preserved() -> Result<()> {
    let dir = Path::new("/specs");
    assert_eq!(
        resolve("rally 'hello world'", dir)?,
        ["rally", "hello world"]
    );
    assert_eq!(
        resolve("node ./helper.js arg", dir)?,
        vec![
            "node".to_owned(),
            dir.join("./helper.js").to_string_lossy().into_owned(),
            "arg".into()
        ]
    );
    assert!(resolve("", dir).is_err());
    Ok(())
}

#[test]
fn filters_and_timeout_validation() -> Result<()> {
    assert_eq!(tags(Some("Dispatch, SLOW,,".into())), ["dispatch", "slow"]);
    assert!(regex(Some("(".into()), "FILE_PATTERN").is_err());
    assert!(regex(Some("".into()), "FILE_PATTERN")?.is_none());
    for invalid in ["0", "-1", "NaN", "inf", "nope"] {
        assert!(positive_seconds(invalid).is_err());
    }
    assert_eq!(positive_seconds("0.1").unwrap(), 0.1);
    Ok(())
}
