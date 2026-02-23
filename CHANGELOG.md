# Changelog

## [Unreleased]

### Added
- Non-TTY dashboard output for piped environments (#25)
- Keyboard navigation for interactive dashboard (#23)
- Comprehensive error handling with exit codes (#26)
- Edge case handling and idempotency (#27)
- Dispatch context validation for PR fields (#41)
- Tool detection (git, gh, npx) with actionable error messages

### Changed
- Dropped Node.js 18 support (EOL); minimum is now Node.js 20
- Replaced JSX test loader with pre-build step for faster test execution
