# Agent Builder

A TypeScript library for building AI agents with tool calling capabilities, autonomous orchestration, and LLM integration.

[![npm version](https://badge.fury.io/js/agent-builder.svg)](https://www.npmjs.com/package/agent-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🛠️ **Tool Management** - Create and manage tools with schema validation
- 🤖 **Agentic Tools** - Tools that extract parameters from natural language
- 🔄 **Automatic Retries** - Built-in retry logic for failed tool calls
- 🎯 **Autonomous Orchestration** - Break down complex tasks into executable steps
- ✅ **OpenAPI Schema Validation** - Validate tool parameters against OpenAPI-style schemas
- 📝 **Full TypeScript Support** - Complete type definitions included

## Installation

```bash
npm install @siddharthapudasaini/agent-builder
```

## Quick Start

```typescript
import { LLMService, Agent, Orchestrator, createTool } from 'agent-builder';

// 1. Create an LLM Service
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

// 2. Create tools
const calculatorTool = createTool(
  'calculator',
  'Performs arithmetic calculations',
  {
    operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
    a: { type: 'number' },
    b: { type: 'number' }
  },
  async ({ operation, a, b }) => {
    switch (operation) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return a / b;
    }
  },
  { agentic: true }
);

// 3. Create an Agent
const agent = new Agent({
  tools: [calculatorTool],
  llmService,
  maxRetries: 3
});

// 4. Use the agent
const result = await agent.callTool({
  tool: 'calculator',
  context: 'What is 15 multiplied by 7?'
});
console.log(result); // 105

// 5. Or use the Orchestrator for complex tasks
const orchestrator = new Orchestrator({ agent, maxSteps: 10 });
const taskResult = await orchestrator.execute(
  'Add 10 and 20, then multiply the result by 3'
);
console.log(taskResult.finalResponse);
```

## Documentation

- [Full Documentation](./docs/README.md)
- [API Reference](./docs/API_QUICK_REFERENCE.md)
- [Examples & Tutorials](./docs/EXAMPLES.md)

## Core Concepts

### LLMService
Handles all communication with LLM providers (OpenAI-compatible APIs).

### Agent
Manages tool registration and execution with validation and retry logic.

### Orchestrator
Enables autonomous multi-step task execution using LLM-based planning.

### Tools
Functions that the agent can call, with optional "agentic" capability to extract parameters from natural language.

## License

MIT © Siddhartha Pudasaini
