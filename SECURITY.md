# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.4.x   | :white_check_mark: |
| 2.3.x   | :white_check_mark: |
| < 2.3   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please send an email to security@gr3pme.dev with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

**Please do not open a public issue for security vulnerabilities.**

We will respond within 48 hours and work with you to understand and address the issue.

## Security Measures

### Encryption

- All secrets are encrypted using AES-256-GCM
- Unique initialization vectors (IV) for each encryption
- Authentication tags to prevent tampering
- PBKDF2 for password-based key derivation (100,000 iterations)

### Key Management

- Encryption keys stored with restricted permissions (0600)
- Machine-specific encryption keys in `~/.config/app-repo/encryption.key`
- Support for custom encryption keys per environment

### Best Practices

1. **Never commit secrets** to version control
2. **Use TTL** for temporary secrets
3. **Enable auto-sync** with caution in production
4. **Audit logs** regularly when using cloud providers
5. **Rotate secrets** periodically

## Known Security Considerations

### Local Provider

- Encrypted values are only as secure as the machine's encryption key
- Ensure proper file system permissions on config directories
- Consider using hardware security modules (HSM) for production

### AWS SSM Provider

- Requires proper IAM permissions
- Uses AWS KMS for SecureString encryption
- Enable CloudTrail for audit logging

### Network Security

- MCP integration uses SSE over HTTPS
- Validate SSL certificates
- Use private networks when possible

## Dependency Security

We regularly audit dependencies using `npm audit` and update them promptly when security patches are available.

Run security audit:

```bash
npm audit
```

## Compliance

app-repo can be configured to meet various compliance requirements:

- **SOC 2**: Enable audit logging and encryption
- **HIPAA**: Use encrypted secrets and access controls
- **GDPR**: Implement data retention policies

For compliance guidance, please contact compliance@gr3pme.dev.
