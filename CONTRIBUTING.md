# Contributing to Archisynapse

Welcome to the Archisynapse project! We're excited to have you contribute to building the next generation of payment infrastructure.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and professional in all interactions.

## How to Contribute

### Reporting Issues
- Use the GitHub Issues tab to report bugs or suggest features
- Include clear descriptions, steps to reproduce, and expected vs. actual behavior
- Add relevant labels (bug, enhancement, documentation, etc.)

### Development

#### Setup
1. Clone the repository
2. Install dependencies: `npm install` (or `yarn install`)
3. Copy `.env.example` to `.env.local` and configure
4. Run the development server

#### Branching
- Create feature branches from `main`: `git checkout -b feature/your-feature-name`
- Use descriptive branch names
- Keep commits atomic and well-documented

#### Pull Requests
- Open a PR against `main`
- Include a clear description of changes
- Link related issues
- Ensure all tests pass
- Request review from maintainers

#### Commit Messages
Follow conventional commit format:
```
type(scope): subject

body (optional)
footer (optional)
```

Examples:
- `feat(api): add real-time settlement endpoint`
- `fix(fraud-detection): improve ML accuracy`
- `docs(readme): update installation instructions`

### Testing
- Write tests for all new features
- Run tests before submitting PR: `npm test`
- Aim for >80% code coverage

### Documentation
- Update README if adding new features
- Keep API documentation in sync
- Add comments for complex logic
- Update ROADMAP.md for major changes

## Development Standards

### Code Quality
- Follow ESLint configuration
- Use TypeScript for new code
- Format with Prettier before committing
- Maximum line length: 100 characters

### Security
- Never commit secrets or API keys
- Use environment variables for sensitive data
- Follow OWASP guidelines for security features
- Run security audit: `npm audit`

### Performance
- Target <100ms API response times
- Optimize database queries
- Profile before optimizing
- Document performance considerations

## Review Process

1. **Code Review**: At least one maintainer approval required
2. **Testing**: All CI/CD checks must pass
3. **Documentation**: Ensure docs are updated
4. **Merge**: Squash and merge to keep history clean

## Getting Help

- Check existing issues and documentation first
- Ask questions in GitHub Discussions
- Contact maintainers directly for sensitive topics

## Roadmap Items

See [ROADMAP.md](./ROADMAP.md) for current priorities and planned features.

---

Thank you for contributing to Archisynapse! 🚀