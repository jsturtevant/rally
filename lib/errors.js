export const EXIT_SUCCESS = 0;
export const EXIT_GENERAL = 1;
export const EXIT_CONFIG = 2;
export const EXIT_GIT = 3;
export const EXIT_GITHUB = 4;

export class RallyError extends Error {
  constructor(message, exitCode = EXIT_GENERAL) {
    super(message);
    this.name = 'RallyError';
    this.exitCode = exitCode;
  }
}

export function fatal(message, exitCode = EXIT_GENERAL, opts = {}) {
  const _console = opts._console || console;
  const _process = opts._process || process;
  _console.error(`Error: ${message}`);
  _process.exit(exitCode);
}

export function handleError(err, opts = {}) {
  const exitCode = err instanceof RallyError ? err.exitCode : EXIT_GENERAL;
  fatal(err.message, exitCode, opts);
}
