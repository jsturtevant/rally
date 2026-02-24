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

export function fatal(message, exitCode = EXIT_GENERAL) {
  throw new RallyError(message, exitCode);
}

export function handleError(err) {
  if (err instanceof RallyError) {
    throw err;
  }
  throw new RallyError(err.message, EXIT_GENERAL);
}
