use anyhow::{Result, bail};
use regex::Regex;
use std::sync::LazyLock;

pub fn strip_ansi(text: &str) -> String {
    static ANSI: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"\x1b\[[?]?[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07").unwrap());
    ANSI.replace_all(text, "").into_owned()
}

fn lines(text: &str) -> Vec<String> {
    text.replace("\\\\", "/")
        .replace('\\', "/")
        .lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|line| !line.is_empty())
        .collect()
}

pub fn prepare(actual: &str, expected: &str) -> (Vec<String>, Vec<String>) {
    let raw = lines(actual);
    let expected = lines(expected);
    let mut actual = Vec::new();
    let (mut a, mut e) = (0, 0);
    while a < raw.len() {
        let mut wrapped = false;
        if let Some(exp) = expected.get(e) {
            for n in 2..=3 {
                if a + n > raw.len() {
                    break;
                }
                let joined = raw[a..a + n].join(" ");
                let no_space = raw[a..a + n].join("");
                if &joined == exp || &no_space == exp {
                    actual.push(exp.clone());
                    a += n;
                    e += 1;
                    wrapped = true;
                    break;
                }
            }
        }
        if wrapped {
            continue;
        }
        if expected.get(e) == Some(&raw[a]) {
            e += 1;
        }
        actual.push(raw[a].clone());
        a += 1;
    }
    (actual, expected)
}

pub fn check(actual: &str, expected: &str, contains: bool) -> Result<()> {
    let (actual, expected) = prepare(actual, expected);
    if contains {
        let mut a = 0;
        for (e, exp) in expected.iter().enumerate() {
            while a < actual.len() && &actual[a] != exp {
                a += 1;
            }
            if a == actual.len() {
                bail!(
                    "Expected line {} not found in output:\n  expected: {exp:?}",
                    e + 1
                );
            }
            a += 1;
        }
        if a < actual.len() {
            bail!(
                "Actual output has {} unmatched trailing line(s):\n{}",
                actual.len() - a,
                actual[a..].join("\n")
            );
        }
    } else {
        for i in 0..actual.len().max(expected.len()) {
            match (actual.get(i), expected.get(i)) {
                (Some(act), Some(exp)) if act != exp => bail!(
                    "Line {} mismatch:\n  expected: {exp:?}\n  actual:   {act:?}",
                    i + 1
                ),
                (Some(act), None) => bail!("Extra actual line {}:\n  + {act:?}", i + 1),
                (None, Some(exp)) => bail!("Missing expected line {}:\n  - {exp:?}", i + 1),
                _ => {}
            }
        }
    }
    Ok(())
}

pub fn diff(actual: &str, expected: &str) -> String {
    let (actual, expected) = prepare(actual, expected);
    (0..actual.len().max(expected.len()))
        .map(|i| match (actual.get(i), expected.get(i)) {
            (Some(act), Some(exp)) if act == exp => format!("    {exp}"),
            (Some(act), Some(exp)) => format!("  - {exp}\n  + {act}"),
            (Some(act), None) => format!("  + {act}"),
            (None, Some(exp)) => format!("  - {exp}"),
            _ => unreachable!(),
        })
        .collect::<Vec<_>>()
        .join("\n")
}
