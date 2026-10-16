mod matching;
mod process;
mod spec;

use anyhow::{Context, Result, bail};
use clap::Parser;
use regex::Regex;
use std::{
    env, fs,
    path::{Path, PathBuf},
    time::Duration,
};
use tempfile::{Builder, TempDir};

#[derive(Debug, Parser)]
#[command(version, about)]
struct Options {
    /// Directory containing Markdown specifications, searched recursively.
    #[arg(default_value = "test/e2e/cli")]
    spec_dir: PathBuf,
    /// Working directory for specs without clone frontmatter.
    #[arg(long, default_value = ".")]
    cwd: PathBuf,
    /// Name of the isolated application-home environment variable and placeholder.
    #[arg(long, default_value = "E2E_HOME")]
    home_env: String,
    /// Prefix for FILE_PATTERN, FILE_EXCLUDE, TAGS and TAGS_EXCLUDE environment filters.
    #[arg(long, default_value = "E2E_")]
    env_prefix: String,
    #[arg(long)]
    file_pattern: Option<String>,
    #[arg(long)]
    file_exclude: Option<String>,
    #[arg(long)]
    tags: Option<String>,
    #[arg(long)]
    tags_exclude: Option<String>,
    /// Regex matching a file name or command heading.
    #[arg(long = "test-name-pattern")]
    name_patterns: Vec<String>,
    /// Default per-command timeout in seconds; frontmatter takes precedence.
    #[arg(long, default_value = "30", value_parser = positive_seconds)]
    timeout: f64,
    /// Print commands without executing them or creating fixtures.
    #[arg(long)]
    list: bool,
    #[arg(long)]
    verbose: bool,
}

fn positive_seconds(text: &str) -> std::result::Result<f64, String> {
    let value = text.parse::<f64>().map_err(|e| e.to_string())?;
    if !value.is_finite() || value <= 0.0 || Duration::try_from_secs_f64(value).is_err() {
        return Err("timeout must be positive, finite seconds".to_owned());
    }
    Ok(value)
}

fn regex(value: Option<String>, name: &str) -> Result<Option<Regex>> {
    value
        .filter(|s| !s.is_empty())
        .map(|s| Regex::new(&s).with_context(|| format!("Invalid {name} regex")))
        .transpose()
}

fn tags(value: Option<String>) -> Vec<String> {
    value
        .unwrap_or_default()
        .split(',')
        .map(|tag| tag.trim().to_lowercase())
        .filter(|tag| !tag.is_empty())
        .collect()
}

fn discover(dir: &Path, base: &Path, files: &mut Vec<String>) -> Result<()> {
    for entry in fs::read_dir(dir).with_context(|| format!("Cannot read {}", dir.display()))? {
        let entry = entry?;
        let path = entry.path();
        let kind = entry.file_type()?;
        if kind.is_dir() {
            discover(&path, base, files)?;
        } else if kind.is_file() && path.extension().is_some_and(|ext| ext == "md") {
            files.push(
                path.strip_prefix(base)?
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
        }
    }
    Ok(())
}

fn resolve(command: &str, dir: &Path) -> Result<Vec<String>> {
    let mut args = spec::split_command(command);
    let name = args
        .first()
        .context("Empty command in pipeline stage")?
        .clone();
    if name == "node" && args.get(1).is_some_and(|arg| arg.starts_with("./")) {
        args[1] = dir.join(&args[1]).to_string_lossy().into_owned();
    }
    Ok(args)
}

fn resolve_setup(command: &str, dir: &Path) -> Result<Vec<String>> {
    let mut args = spec::split_command(command);
    if args.first().is_none_or(|arg| arg.is_empty()) {
        bail!("Empty setup command");
    }
    for arg in &mut args {
        let path = Path::new(arg);
        if path.is_absolute() || arg.is_empty() || arg.starts_with('-') {
            continue;
        }
        let explicit_relative = matches!(
            path.components().next(),
            Some(std::path::Component::CurDir | std::path::Component::ParentDir)
        );
        let resolved = dir.join(path);
        if explicit_relative || resolved.is_file() {
            *arg = resolved.to_string_lossy().into_owned();
        }
    }
    Ok(args)
}

struct Fixture {
    _home: TempDir,
    _config: TempDir,
    _repo: Option<TempDir>,
    cwd: PathBuf,
    env: process::Environment,
    vars: Vec<(String, String)>,
}

fn gh_config_dir() -> Result<PathBuf> {
    if let Some(dir) = env::var_os("GH_CONFIG_DIR") {
        return Ok(dir.into());
    }
    if let Some(dir) = env::var_os("XDG_CONFIG_HOME") {
        return Ok(PathBuf::from(dir).join("gh"));
    }
    #[cfg(windows)]
    if let Some(dir) = env::var_os("APPDATA") {
        return Ok(PathBuf::from(dir).join("GitHub CLI"));
    }
    let home = env::var_os("HOME").or_else(|| env::var_os("USERPROFILE"));
    Ok(
        PathBuf::from(home.context("Cannot resolve home directory for gh configuration")?)
            .join(".config/gh"),
    )
}

impl Fixture {
    fn new(options: &Options, spec: &spec::Spec, gh_config: &Path) -> Result<Self> {
        let home = Builder::new().prefix("markdown-e2e-home-").tempdir()?;
        let config = Builder::new().prefix("markdown-e2e-xdg-").tempdir()?;
        let mut env: process::Environment = env::vars_os().collect();
        for (key, value) in [
            ("NO_COLOR", "1"),
            ("FORCE_COLOR", "0"),
            ("GIT_TERMINAL_PROMPT", "0"),
            ("GH_PROMPT_DISABLED", "1"),
        ] {
            env.insert(key.into(), value.into());
        }
        env.insert("GH_CONFIG_DIR".into(), gh_config.as_os_str().into());
        env.insert(
            options.home_env.clone().into(),
            home.path().as_os_str().into(),
        );
        env.insert("XDG_CONFIG_HOME".into(), config.path().as_os_str().into());
        #[cfg(windows)]
        for name in ["APPDATA", "LOCALAPPDATA"] {
            env.insert(name.into(), config.path().as_os_str().into());
        }
        let mut cwd = options.cwd.canonicalize()?;
        let repo = if let Some(owner_repo) = &spec.clone {
            let auth = process::run(
                &["gh".into(), "auth".into(), "status".into()],
                &cwd,
                &env,
                None,
                Duration::from_secs(30),
            )
            .context("gh not installed or unavailable; install GitHub CLI to clone fixtures")?;
            if auth.code != 0 {
                bail!("gh not authenticated. Run 'gh auth login'.\n{}", auth.text);
            }
            let repo = Builder::new().prefix("markdown-e2e-repo-").tempdir()?;
            let cloned = process::run(
                &[
                    "gh".into(),
                    "repo".into(),
                    "clone".into(),
                    owner_repo.clone(),
                    repo.path().to_string_lossy().into_owned(),
                ],
                &cwd,
                &env,
                None,
                Duration::from_secs(30),
            )?;
            if cloned.code != 0 {
                bail!("Failed to clone {owner_repo}:\n{}", cloned.text);
            }
            cwd = repo.path().to_owned();
            Some(repo)
        } else {
            None
        };
        let vars = vec![
            (
                format!("${}", options.home_env),
                home.path().to_string_lossy().into_owned(),
            ),
            ("$REPO_ROOT".into(), cwd.to_string_lossy().into_owned()),
            (
                "$PROJECT_NAME".into(),
                cwd.file_name()
                    .context("Working directory has no basename")?
                    .to_string_lossy()
                    .into_owned(),
            ),
            (
                "$XDG_CONFIG_HOME".into(),
                config.path().to_string_lossy().into_owned(),
            ),
        ];
        Ok(Self {
            _home: home,
            _config: config,
            _repo: repo,
            cwd,
            env,
            vars,
        })
    }

    fn substitute(&self, text: &str) -> String {
        self.vars
            .iter()
            .fold(text.to_owned(), |text, (key, value)| {
                text.replace(key, value)
            })
    }

    fn close(self) -> Result<()> {
        if let Some(repo) = self._repo {
            repo.close().context("Failed to clean up cloned fixture")?;
        }
        self._home
            .close()
            .context("Failed to clean up application home")?;
        self._config
            .close()
            .context("Failed to clean up isolated configuration")?;
        Ok(())
    }
}

fn execute(
    case: &spec::Case,
    fixture: &Fixture,
    dir: &Path,
    timeout: Duration,
    verbose: bool,
) -> Result<()> {
    let command = fixture.substitute(&case.command);
    let output = if let Some(steps) = &case.pty {
        process::pty(
            &resolve(&command, dir)?,
            &fixture.cwd,
            &fixture.env,
            steps,
            timeout,
        )?
    } else {
        let stages = spec::split_pipeline(&command);
        if stages.is_empty() {
            bail!("Empty pipeline: no commands to execute");
        }
        let mut input = case.stdin.as_ref().map(|s| s.as_bytes().to_vec());
        let mut output = None;
        for stage in stages {
            let result = process::run(
                &resolve(&stage, dir)?,
                &fixture.cwd,
                &fixture.env,
                input,
                timeout,
            )?;
            if result.code != 0 {
                output = Some(result);
                break;
            }
            input = Some(result.text.as_bytes().to_vec());
            output = Some(result);
        }
        output.context("Pipeline produced no output")?
    };
    if verbose {
        println!("ACTUAL:\n{}", output.text);
    }
    if let Some(expected) = &case.expected {
        let expected = fixture.substitute(expected);
        let result = matching::check(&output.text, &expected, case.contains || case.pty.is_some());
        if verbose || result.is_err() {
            println!(
                "ACTUAL:\n{}\nDIFF (expected vs actual):\n{}",
                output.text,
                matching::diff(&output.text, &expected)
            );
        }
        result?;
    }
    if output.code != case.exit_code {
        bail!(
            "Command exited with code {} (expected exit {}).\nOutput:\n{}",
            output.code,
            case.exit_code,
            output.text
        );
    }
    Ok(())
}

fn run(options: Options) -> Result<bool> {
    if options.home_env.is_empty() || options.home_env.contains(['=', '\0']) {
        bail!("Invalid --home-env name");
    }
    let from_env = |flag: &Option<String>, suffix: &str| {
        flag.clone()
            .or_else(|| env::var(format!("{}{suffix}", options.env_prefix)).ok())
    };
    let include = regex(
        from_env(&options.file_pattern, "FILE_PATTERN"),
        "FILE_PATTERN",
    )?;
    let exclude = regex(
        from_env(&options.file_exclude, "FILE_EXCLUDE"),
        "FILE_EXCLUDE",
    )?;
    let include_tags = tags(from_env(&options.tags, "TAGS"));
    let exclude_tags = tags(from_env(&options.tags_exclude, "TAGS_EXCLUDE"));
    let names = options
        .name_patterns
        .iter()
        .map(|name| Regex::new(name).context("Invalid --test-name-pattern regex"))
        .collect::<Result<Vec<_>>>()?;
    let verbose = options.verbose
        || env::var("VERBOSE")
            .is_ok_and(|v| ["1", "true", "yes"].contains(&v.trim().to_lowercase().as_str()));
    let root = options.spec_dir.canonicalize().with_context(|| {
        format!(
            "Cannot find specification directory {}",
            options.spec_dir.display()
        )
    })?;
    let mut files = Vec::new();
    discover(&root, &root, &mut files)?;
    files.sort();
    let mut specs = Vec::new();
    for file in files {
        if include.as_ref().is_some_and(|re| !re.is_match(&file))
            || exclude.as_ref().is_some_and(|re| re.is_match(&file))
        {
            continue;
        }
        let spec = spec::parse(&fs::read_to_string(root.join(&file))?)
            .with_context(|| format!("Invalid spec {file}"))?;
        if include_tags.iter().any(|tag| !spec.tags.contains(tag))
            || exclude_tags.iter().any(|tag| spec.tags.contains(tag))
        {
            continue;
        }
        let indices: Vec<_> = spec
            .cases
            .iter()
            .enumerate()
            .filter(|(_, case)| {
                names.is_empty()
                    || names
                        .iter()
                        .any(|re| re.is_match(&file) || re.is_match(&case.command))
            })
            .map(|(i, _)| i)
            .collect();
        if names.is_empty() || !indices.is_empty() {
            specs.push((file, spec, indices));
        }
    }
    if specs.is_empty() {
        bail!("No markdown test specs matched in {}", root.display());
    }
    // Resolve authentication before replacing XDG_CONFIG_HOME in each fixture.
    let gh_config = gh_config_dir()?;
    let (mut passed, mut failed) = (0, 0);
    for (file, spec, indices) in specs {
        println!("{file}");
        if spec.cases.is_empty() {
            eprintln!("  FAIL: No test cases found. Expected headings like ## `command`");
            failed += 1;
            continue;
        }
        if options.list {
            for index in indices {
                println!("  {}", spec.cases[index].command);
            }
            continue;
        }
        let timeout = spec
            .timeout
            .unwrap_or(Duration::from_secs_f64(options.timeout));
        let dir = root
            .join(&file)
            .parent()
            .context("Spec has no parent directory")?
            .to_owned();
        let fixture = match Fixture::new(&options, &spec, &gh_config) {
            Ok(fixture) => fixture,
            Err(error) => {
                eprintln!("  FAIL setup: {error:#}");
                failed += 1;
                continue;
            }
        };
        let setup_result = (|| -> Result<()> {
            if let Some(setup) = &spec.setup {
                let args = resolve_setup(setup, &dir)?;
                let result = process::run(&args, &options.cwd, &fixture.env, None, timeout)
                    .with_context(|| format!("Setup command failed: {setup}"))?;
                if result.code != 0 {
                    bail!("Setup command failed: {setup}\n{}", result.text);
                }
                if verbose {
                    println!("Setup ({setup}):\n{}", result.text);
                }
            }
            Ok(())
        })();
        if let Err(error) = setup_result {
            eprintln!("  FAIL setup: {error:#}");
            failed += 1;
        } else {
            for index in indices {
                let case = &spec.cases[index];
                match execute(case, &fixture, &dir, timeout, verbose) {
                    Ok(()) => {
                        passed += 1;
                        println!("  PASS {}", case.command);
                    }
                    Err(error) => {
                        failed += 1;
                        eprintln!("  FAIL {}: {error:#}", case.command);
                    }
                }
            }
        }
        if let Err(error) = fixture.close() {
            eprintln!("  FAIL cleanup: {error:#}");
            failed += 1;
        }
    }
    if !options.list {
        println!("\npass {passed}\nfail {failed}");
    }
    Ok(failed == 0)
}

fn main() -> std::process::ExitCode {
    #[cfg(windows)]
    if env::args_os()
        .nth(1)
        .is_some_and(|arg| arg == "--internal-exec")
    {
        process::internal_exec();
    }
    match run(Options::parse()) {
        Ok(true) => std::process::ExitCode::SUCCESS,
        Ok(false) => std::process::ExitCode::FAILURE,
        Err(error) => {
            eprintln!("Error: {error:#}");
            std::process::ExitCode::FAILURE
        }
    }
}

#[cfg(test)]
mod tests;
