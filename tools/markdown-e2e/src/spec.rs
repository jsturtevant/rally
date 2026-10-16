use anyhow::{Context, Result, bail};
use regex::Regex;
use serde_yaml::Value;
use std::time::Duration;

#[derive(Debug, Default)]
pub struct Spec {
    pub clone: Option<String>,
    pub setup: Option<String>,
    pub tags: Vec<String>,
    pub timeout: Option<Duration>,
    pub cases: Vec<Case>,
}

#[derive(Debug)]
pub struct Case {
    pub command: String,
    pub expected: Option<String>,
    pub exit_code: i32,
    pub contains: bool,
    pub stdin: Option<String>,
    pub pty: Option<Vec<Step>>,
}

#[derive(Debug)]
pub struct Step {
    pub text: String,
    pub input: String,
    pub raw: bool,
}

pub fn replace_keys(text: &str, keys: &[(&str, &str)]) -> String {
    keys.iter().fold(text.to_owned(), |text, (key, value)| {
        Regex::new(&format!("(?i){}", regex::escape(key)))
            .unwrap()
            .replace_all(&text, regex::NoExpand(value))
            .into_owned()
    })
}

pub fn raw_keys(text: &str) -> String {
    let text = replace_keys(
        text,
        &[
            ("{hide-cursor}", "\x1b[?25l"),
            ("{show-cursor}", "\x1b[?25h"),
            ("{clear-screen}", "\x1b[2J"),
            ("{alt-screen}", "\x1b[?1049h"),
        ],
    );
    Regex::new(r"\\x([0-9a-fA-F]{2})")
        .unwrap()
        .replace_all(&text, |caps: &regex::Captures<'_>| {
            char::from(u8::from_str_radix(&caps[1], 16).unwrap()).to_string()
        })
        .into_owned()
}

pub fn input_keys(text: &str) -> String {
    replace_keys(
        text,
        &[
            ("{enter}", "\r"),
            ("{up}", "\x1b[A"),
            ("{down}", "\x1b[B"),
            ("{space}", " "),
            ("{backspace}", "\x7f"),
        ],
    )
}

fn parse_steps(lines: &[&str]) -> Result<Vec<Step>> {
    let mut steps = Vec::new();
    let mut pending = None;
    for line in lines {
        let line = line.trim();
        if let Some(text) = line.strip_prefix("match-raw:") {
            pending = Some((raw_keys(text.trim()), true));
        } else if let Some(text) = line.strip_prefix("match:") {
            pending = Some((text.trim().to_owned(), false));
        } else if let Some(input) = line.strip_prefix("send:") {
            let (text, raw) = pending
                .take()
                .context("PTY parse error: send: without preceding match: or match-raw:")?;
            steps.push(Step {
                text,
                input: input.trim().to_owned(),
                raw,
            });
        }
    }
    if pending.is_some() {
        bail!("PTY parse error: trailing match: or match-raw: without a following send:");
    }
    Ok(steps)
}

pub fn parse(content: &str) -> Result<Spec> {
    let mut spec = Spec::default();
    let frontmatter = Regex::new(r"\A---\r?\n([\s\S]*?)\r?\n---\r?\n").unwrap();
    let body = if let Some(caps) = frontmatter.captures(content) {
        let value: Value = serde_yaml::from_str(&caps[1]).context("Invalid YAML frontmatter")?;
        if !value.is_null() {
            let map = value
                .as_mapping()
                .context("Frontmatter must be a YAML object")?;
            for (key, target) in [("clone", &mut spec.clone), ("setup", &mut spec.setup)] {
                if let Some(value) = map.get(Value::from(key)).filter(|v| !v.is_null()) {
                    *target = Some(
                        value
                            .as_str()
                            .with_context(|| format!("Frontmatter {key} must be a string"))?
                            .to_owned(),
                    );
                }
            }
            if let Some(tags) = map.get(Value::from("tags")) {
                for tag in tags
                    .as_sequence()
                    .context("Frontmatter tags must be an array of strings")?
                {
                    let tag = tag
                        .as_str()
                        .context("Frontmatter tags must be an array of strings")?
                        .trim()
                        .to_lowercase();
                    if tag.is_empty() {
                        bail!("Frontmatter tags must not contain empty values");
                    }
                    if !spec.tags.contains(&tag) {
                        spec.tags.push(tag);
                    }
                }
            }
            if let Some(value) = map.get(Value::from("timeout")).filter(|v| !v.is_null()) {
                let seconds = value
                    .as_f64()
                    .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
                    .context("Invalid timeout: expected positive seconds")?;
                if !seconds.is_finite() || seconds <= 0.0 {
                    bail!("Invalid timeout: expected positive seconds");
                }
                spec.timeout = Some(
                    Duration::try_from_secs_f64(seconds)
                        .context("Invalid timeout: out of range")?,
                );
            }
        }
        &content[caps.get(0).unwrap().end()..]
    } else {
        content
    };
    let heading = Regex::new(r"^##\s+`([^`]+)`(?:\s+\(exit\s+(\d+)\))?").unwrap();
    let next_heading = Regex::new(r"^##\s+`").unwrap();
    let lines: Vec<_> = body.split('\n').map(|s| s.trim_end_matches('\r')).collect();
    let mut i = 0;
    while i < lines.len() {
        let Some(caps) = heading.captures(lines[i]) else {
            i += 1;
            continue;
        };
        let mut case = Case {
            command: caps[1].to_owned(),
            exit_code: caps.get(2).map_or(Ok(0), |m| m.as_str().parse())?,
            expected: None,
            contains: false,
            stdin: None,
            pty: None,
        };
        i += 1;
        while i < lines.len() && !next_heading.is_match(lines[i]) {
            let kind = ["expected-contains", "expected", "stdin", "pty"]
                .into_iter()
                .find(|kind| lines[i].starts_with(&format!("```{kind}")));
            if let Some(kind) = kind {
                i += 1;
                let start = i;
                while i < lines.len() && lines[i].trim_end() != "```" {
                    i += 1;
                }
                let block = lines[start..i].join("\n");
                match kind {
                    "expected-contains" => {
                        case.expected = Some(block);
                        case.contains = true;
                    }
                    "expected" => case.expected = Some(block),
                    "stdin" => case.stdin = Some(block + "\n"),
                    "pty" => case.pty = Some(parse_steps(&lines[start..i])?),
                    _ => unreachable!(),
                }
            }
            i += 1;
        }
        spec.cases.push(case);
    }
    Ok(spec)
}

// Deliberately not shell parsing: backslashes are literal, and empty quoted arguments survive.
pub fn split_command(command: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote = None;
    let mut in_token = false;
    for ch in command.trim().chars() {
        if let Some(q) = quote {
            if ch == q {
                quote = None;
            } else {
                current.push(ch);
            }
        } else if ch == '\'' || ch == '"' {
            quote = Some(ch);
            in_token = true;
        } else if ch.is_whitespace() {
            if in_token {
                tokens.push(std::mem::take(&mut current));
                in_token = false;
            }
        } else {
            current.push(ch);
            in_token = true;
        }
    }
    if in_token {
        tokens.push(current);
    }
    tokens
}

pub fn split_pipeline(command: &str) -> Vec<String> {
    let mut stages = Vec::new();
    let mut current = String::new();
    let mut quote = None;
    for ch in command.chars() {
        if let Some(q) = quote {
            if ch == q {
                quote = None;
            }
            current.push(ch);
        } else if ch == '\'' || ch == '"' {
            quote = Some(ch);
            current.push(ch);
        } else if ch == '|' {
            if !current.trim().is_empty() {
                stages.push(current.trim().to_owned());
            }
            current.clear();
        } else {
            current.push(ch);
        }
    }
    if !current.trim().is_empty() {
        stages.push(current.trim().to_owned());
    }
    stages
}
