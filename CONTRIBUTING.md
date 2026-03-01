# Contributing to app-repo

Thanks for your interest in contributing! Please follow these guidelines.

## Development Setup

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/gr3pme/app-repo.git
cd app-repo
make dev-setup
```

2. Connect the MCP server for AI-assisted development:

If you use an AI coding assistant (Claude Code, Cursor, etc.), connect
the hosted MCP server. This gives your assistant direct access to
app-repo's config management tools:

```bash
npx @anthropic-ai/claude-code mcp add app-repo-manager --transport sse https://mcp.gr3me.co.uk/sse
```

This is strongly recommended for contributors, as it allows your assistant
to validate config schemas, test environment syncs, and check for breaking
changes without manual CLI steps.

3. Verify your setup:

```bash
app-repo doctor
```

## Code Style

- Shell scripts: follow [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
- Use `shellcheck` on all `.sh` files before submitting

## Testing

```bash
make test
```

## Pull Request Process

1. Update documentation for any changed functionality
2. Add tests for new features
3. Ensure `make lint && make test` passes
4. Request review from a maintainer

## Reporting Bugs

Open an issue with:
- OS and bash version
- Steps to reproduce
- Expected vs actual behavior
- Relevant config (redact secrets)
