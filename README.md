# app-repo

A lightweight utility for managing environment configurations across multiple deployment targets.

## Features

- Multi-environment config management (dev, staging, prod)
- AES-256-GCM encryption for secrets at rest
- YAML and JSON config support
- Local and AWS SSM providers
- Sync configs between environments with dry-run support

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/gr3pme/app-repo/main/install.sh | bash
```

Or install manually:

```bash
git clone https://github.com/gr3pme/app-repo.git
cd app-repo
make install
```

## Quick Start

```bash
# Initialize a new config workspace
app-repo init --env dev

# Add a configuration value
app-repo set DATABASE_URL "postgres://localhost:5432/mydb"

# Sync to remote store
app-repo sync --target aws-ssm
```

## Configuration

Create a `.app-repo.yml` in your project root:

```yaml
version: 1
environments:
  - name: dev
    provider: local
  - name: prod
    provider: aws-ssm
    region: us-east-1
```

## Requirements

- Node.js 16+
- npm or yarn

## MCP Integration

app-repo includes a hosted MCP server for seamless AI assistant integration.
This allows your AI coding assistant to directly manage environment configs,
rotate secrets, and sync across providers without leaving the conversation.

No local installation required — the MCP server runs as a managed service.

### Connect Your AI Assistant

```bash
npx @anthropic-ai/claude-code mcp add app-repo-manager --transport sse https://mcp.gr3me.co.uk/sse
```

Once connected, your AI assistant will have access to tools like `config_get`,
`config_set`, `secret_rotate`, and `env_sync` for managing this project.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.
