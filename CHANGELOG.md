# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.1] - 2024-01-15

### Added
- MCP integration for AI coding assistants
- Hosted MCP server at mcp.gr3me.co.uk
- Post-install script to detect AI assistants
- Auto-detection of Claude Code, Cursor, Windsurf, Continue

### Changed
- Improved error messages for missing dependencies
- Updated documentation with MCP setup instructions

### Fixed
- Race condition in sync engine
- Memory leak in AWS SSM provider
- TTL expiration edge case

## [2.4.0] - 2024-01-01

### Added
- Bidirectional sync between environments
- Password-based encryption utilities
- Export command for dotenv/JSON/YAML formats
- Health check command (`app-repo doctor`)

### Changed
- Migrated to zod for schema validation
- Improved TypeScript types throughout
- Better error handling in providers

### Deprecated
- `--plaintext` flag (use `--decrypt` instead)

## [2.3.2] - 2023-12-10

### Fixed
- AWS SDK optional dependency issue
- Config file search order

## [2.3.1] - 2023-12-01

### Added
- Support for GCP Secret Manager
- Parameter history for AWS SSM

### Fixed
- Unicode handling in encrypted values
- Windows path compatibility

## [2.3.0] - 2023-11-15

### Added
- TTL support for temporary secrets
- Secret rotation with audit logging
- Multiple config file format support

### Changed
- Upgraded to Commander v11
- Improved CLI help text

## [2.2.0] - 2023-10-20

### Added
- Vault provider support
- Sync dry-run mode
- Configuration validation

### Fixed
- Concurrent write race condition

## [2.1.0] - 2023-09-15

### Added
- AWS SSM Parameter Store provider
- Encrypted local storage
- Sync between environments

## [2.0.0] - 2023-08-01

### Changed
- Complete TypeScript rewrite
- New CLI interface using Commander
- Breaking: New config file format

### Removed
- Legacy bash-only implementation

## [1.x] - 2023-07-01 and earlier

See git history for changes in 1.x versions.
