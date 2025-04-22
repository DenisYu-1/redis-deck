# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it via one of the following methods:

1. **Email**: Send details to [your-email@example.com] (replace with your actual email)
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature if available

### What to Include

When reporting a vulnerability, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- We will acknowledge receipt within 48 hours
- We will provide an initial assessment within 7 days
- We will keep you informed of our progress

### Security Best Practices

When using this tool:
- Never commit `.env` files with real credentials
- Use environment variables for sensitive configuration
- Run the application in a secure network environment
- Keep Redis instances protected with authentication
- Use TLS when connecting to remote Redis instances
- Regularly update dependencies: `npm audit` and `npm audit fix`

## Security Considerations

This tool provides direct access to Redis instances. Please ensure:
- The application is not exposed to untrusted networks
- Redis authentication is properly configured
- Network access is restricted appropriately
- Regular security audits are performed




