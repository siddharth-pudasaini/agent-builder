# Contributing to Agent Builder

Thank you for your interest in contributing to Agent Builder! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

This project follows a standard code of conduct. Please be respectful and constructive in all interactions.

---

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- TypeScript knowledge
- An OpenAI API key (for running integration tests)

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/your-org/agent-builder.git
cd agent-builder

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

---

## Development Setup

### Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your-api-key-here
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Run TypeScript type checking |

---

## Project Structure

```
agent-builder/
├── implementations/       # Concrete class implementations
│   ├── agent.ts          # Agent implementation
│   ├── llmService.ts     # LLM Service implementation
│   └── orchestrator.ts   # Orchestrator implementation
├── interfaces/           # TypeScript interfaces
│   ├── agent.interface.ts
│   ├── llmService.interface.ts
│   └── orchestrator.interface.ts
├── types/                # Type definitions
│   ├── agent.types.ts
│   ├── llmService.types.ts
│   ├── orchestrator.types.ts
│   └── openAPISpec.types.ts
├── utils/                # Utility functions
│   └── openApiSpec.ts    # Schema validation utilities
├── docs/                 # Documentation
│   ├── README.md
│   ├── API_QUICK_REFERENCE.md
│   └── EXAMPLES.md
├── examples/             # Example code
│   └── getting-started.ts
├── index.ts              # Main entry point
└── package.json
```

---

## Coding Guidelines

### TypeScript Standards

1. **Use strict typing**: Avoid `any` type when possible
2. **Document public APIs**: Use JSDoc comments for all public methods
3. **Follow existing patterns**: Look at existing code for style guidance
4. **Use meaningful names**: Variables and functions should be self-documenting

### JSDoc Example

```typescript
/**
 * Executes a tool call with retry logic
 *
 * @param {ToolCall} toolCall - The tool call to execute
 * @returns {Promise<unknown>} The tool execution result
 * @throws {AgentError} When tool execution fails after all retries
 *
 * @example
 * ```typescript
 * const result = await agent.callTool({
 *   tool: 'calculator',
 *   arguments: { a: 5, b: 3 }
 * });
 * ```
 */
async callTool(toolCall: ToolCall): Promise<unknown> {
  // Implementation
}
```

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in multi-line objects/arrays
- Keep lines under 100 characters
- Use meaningful commit messages

### Interface-First Design

This project follows interface-first design:

1. Define the interface in `interfaces/`
2. Define types in `types/`
3. Implement in `implementations/`
4. Export from `index.ts`

---

## Testing

### Test Structure

```
tests/
├── unit/
│   ├── agent.test.ts
│   ├── llmService.test.ts
│   └── orchestrator.test.ts
├── integration/
│   └── workflow.test.ts
└── mocks/
    └── mockLLMService.ts
```

### Writing Tests

```typescript
import { Agent, createTool } from '../index';
import { MockLLMService } from './mocks/mockLLMService';

describe('Agent', () => {
  let agent: Agent;
  let mockLLM: MockLLMService;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    agent = new Agent({
      tools: [/* test tools */],
      llmService: mockLLM
    });
  });

  describe('callTool', () => {
    it('should execute tool with valid arguments', async () => {
      const result = await agent.callTool({
        tool: 'test_tool',
        arguments: { input: 'test' }
      });
      expect(result).toBeDefined();
    });

    it('should throw error for unknown tool', async () => {
      await expect(
        agent.callTool({ tool: 'unknown', arguments: {} })
      ).rejects.toThrow(AgentError);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- agent.test.ts

# Run with coverage
npm test -- --coverage

# Run integration tests (requires API key)
OPENAI_API_KEY=your-key npm run test:integration
```

---

## Submitting Changes

### Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
   - Follow coding guidelines
   - Add tests for new functionality
   - Update documentation if needed
4. **Run checks**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
5. **Commit with a meaningful message**
   ```bash
   git commit -m "feat: add new feature X"
   ```
6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Adding or updating tests
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

Examples:
```
feat: add retry logic to orchestrator
fix: handle null responses in LLM service
docs: update API reference for new methods
test: add integration tests for agentic tools
```

### PR Checklist

Before submitting your PR, ensure:

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] New code has appropriate test coverage
- [ ] Documentation is updated if needed
- [ ] TypeScript compiles without errors
- [ ] Linter passes without errors

---

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Step-by-step instructions
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: Node version, OS, package version
6. **Code Sample**: Minimal reproducible example

### Feature Requests

For feature requests, include:

1. **Use Case**: Why is this feature needed?
2. **Proposed Solution**: How should it work?
3. **Alternatives Considered**: Other approaches you've thought about
4. **Additional Context**: Any other relevant information

---

## Adding New Features

### Adding a New Tool Type

1. Update types in `types/agent.types.ts` if needed
2. Implement handling in `implementations/agent.ts`
3. Add tests in `tests/unit/agent.test.ts`
4. Document in `docs/README.md`
5. Add example in `docs/EXAMPLES.md`

### Adding a New LLM Method

1. Add method signature to `interfaces/llmService.interface.ts`
2. Add types to `types/llmService.types.ts`
3. Implement in `implementations/llmService.ts`
4. Add tests
5. Update documentation

### Adding a New Orchestrator Feature

1. Update interface in `interfaces/orchestrator.interface.ts`
2. Update types in `types/orchestrator.types.ts`
3. Implement in `implementations/orchestrator.ts`
4. Add comprehensive tests
5. Update all relevant documentation

---

## Questions?

If you have questions about contributing, feel free to:

- Open a GitHub Discussion
- Create an issue with the `question` label
- Reach out to the maintainers

Thank you for contributing! 🎉
