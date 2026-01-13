# Agent Builder Library

A TypeScript library for building AI agents with tool calling capabilities, autonomous orchestration, and LLM integration.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [LLMService](#llmservice)
  - [Agent](#agent)
  - [Orchestrator](#orchestrator)
- [Tools](#tools)
- [Advanced Usage](#advanced-usage)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The Agent Builder library provides a modular architecture for creating AI-powered agents that can:

- **Execute Tools**: Call functions with validated parameters and retry logic
- **Generate Structured Output**: Get typed responses from LLMs using schemas
- **Autonomous Orchestration**: Break down complex tasks into steps and execute them automatically
- **Agentic Tools**: Let the LLM extract parameters from natural language

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Orchestrator                          │
│  (Autonomous task planning and execution)                   │
├─────────────────────────────────────────────────────────────┤
│                          Agent                              │
│  (Tool management, execution with retries, validation)      │
├─────────────────────────────────────────────────────────────┤
│                       LLM Service                           │
│  (LLM API communication, structured output, reasoning)      │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation

```bash
npm install agent-builder
```

Or with yarn:

```bash
yarn add agent-builder
```

---

## Quick Start

### Basic Usage

```typescript
import {
  LLMService,
  Agent,
  createTool,
  Orchestrator
} from 'agent-builder';

// 1. Create an LLM Service
const llmService = new LLMService({
  apiKey: 'your-openai-api-key',
  model: 'gpt-4',
  temperature: 0.7
});

// 2. Create tools
const calculatorTool = createTool(
  'calculator',
  'Performs arithmetic calculations',
  {
    operation: { type: 'string', description: 'The operation: add, subtract, multiply, divide' },
    a: { type: 'number', description: 'First number' },
    b: { type: 'number', description: 'Second number' }
  },
  async ({ operation, a, b }) => {
    switch (operation) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return a / b;
      default: throw new Error(`Unknown operation: ${operation}`);
    }
  }
);

// 3. Create an Agent
const agent = new Agent({
  tools: [calculatorTool],
  llmService: llmService,
  maxRetries: 3,
  verbose: true
});

// 4. Call tools directly
const result = await agent.callTool({
  tool: 'calculator',
  arguments: { operation: 'add', a: 5, b: 3 }
});
console.log(result); // 8

// 5. Use the Orchestrator for complex tasks
const orchestrator = new Orchestrator({
  agent: agent,
  maxSteps: 10,
  verbose: true
});

const taskResult = await orchestrator.execute(
  'Calculate the sum of 10 and 20, then multiply the result by 2'
);
console.log(taskResult.finalResponse);
```

---

## Core Concepts

### 1. LLM Service

The `LLMService` is the foundation layer that handles all communication with LLM providers (OpenAI-compatible APIs).

**Key Features:**
- General text responses
- Structured output generation with schema validation
- Reasoning capabilities
- Configurable temperature, max tokens, and model

### 2. Agent

The `Agent` manages tool registration and execution. It provides:
- Tool validation against OpenAPI-style schemas
- Automatic retry logic for failed tool calls
- Support for "agentic" tools that can extract parameters from natural language
- Dependency injection for the LLM service

### 3. Orchestrator

The `Orchestrator` enables autonomous task execution:
- Uses LLM to create an action plan from user queries
- Executes steps sequentially with dependency management
- Handles errors with plan regeneration
- Maintains internal state and conversation history

### 4. Tools

Tools are functions that the agent can call. Each tool has:
- **Name**: Unique identifier
- **Description**: What the tool does
- **Parameters Schema**: OpenAPI-style schema for validation
- **Execute Function**: The actual implementation
- **Agentic Flag**: Whether the tool can extract parameters from context

---

## API Reference

### LLMService

The `LLMService` class provides methods for interacting with Language Learning Models.

#### Constructor

```typescript
const llmService = new LLMService(config: LLMConfig);
```

**LLMConfig Options:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `apiKey` | `string` | Yes | - | API key for the LLM provider |
| `baseUrl` | `string` | No | `https://api.openai.com/v1` | Base URL for the API |
| `model` | `string` | No | `gpt-4.1-2025-04-14` | Model identifier |
| `temperature` | `number` | No | `0.7` | Response randomness (0-1) |
| `maxTokens` | `number` | No | `1000` | Maximum tokens in response |

#### Methods

##### `getResponse(prompt, options?)`

Get a general text response from the LLM.

```typescript
const response = await llmService.getResponse(
  "What is TypeScript?",
  {
    temperature: 0.9,
    maxTokens: 500,
    model: 'gpt-4'
  }
);

console.log(response.content); // The LLM's response text
console.log(response.usage);   // Token usage statistics
```

**Returns:** `Promise<LLMResponse>`

##### `getStructuredOutput<T>(request)`

Get structured data from the LLM based on a schema.

```typescript
interface UserProfile {
  name: string;
  age: number;
  email: string;
}

const response = await llmService.getStructuredOutput<UserProfile>({
  prompt: "Extract user info from: John Doe, 30 years old, john@example.com",
  schema: {
    name: 'string',
    age: 'number',
    email: 'string'
  },
  description: 'User profile extraction'
});

if (response.isValid) {
  console.log(response.structuredData); // { name: "John Doe", age: 30, email: "john@example.com" }
} else {
  console.error(response.validationErrors);
}
```

**StructuredOutputRequest Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `prompt` | `string` | Yes | The prompt for extraction |
| `schema` | `Record<string, unknown>` | Yes | Expected output structure |
| `description` | `string` | No | Description of the data |
| `temperatureOverride` | `number` | No | Override temperature |
| `maxTokensOverride` | `number` | No | Override max tokens |
| `modelOverride` | `string` | No | Override model |

##### `getReasoningResponse(request)`

Get a reasoning response with optional structured output.

```typescript
const response = await llmService.getReasoningResponse({
  prompt: "Analyze the pros and cons of TypeScript",
  context: "For a web development project",
  requireStructuredOutput: true,
  outputSchema: {
    pros: 'array',
    cons: 'array',
    conclusion: 'string'
  }
});
```

##### `validateStructuredOutput<T>(content, schema)`

Validate if text content conforms to a schema.

```typescript
const validation = llmService.validateStructuredOutput(
  '{"name": "John", "age": 30}',
  { name: 'string', age: 'number' }
);

if (validation.isValid) {
  console.log(validation.data);
}
```

##### `getConfig()`

Get the current service configuration.

```typescript
const config = llmService.getConfig();
console.log(`Using model: ${config.model}`);
```

---

### Agent

The `Agent` class manages tools and executes tool calls with validation and retry logic.

#### Constructor

```typescript
const agent = new Agent(config: AgentConfig);
```

**AgentConfig Options:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `tools` | `Tool[]` | Yes | - | Array of tools available to the agent |
| `llmService` | `ILLMService` | Yes | - | LLM service instance |
| `maxRetries` | `number` | No | `3` | Max retry attempts for failed calls |
| `retryDelay` | `number` | No | `1000` | Delay between retries (ms) |
| `verbose` | `boolean` | No | `false` | Enable verbose logging |

#### Methods

##### `callTool(toolCall)`

Execute a single tool call.

```typescript
// With explicit arguments
const result = await agent.callTool({
  tool: 'calculator',
  arguments: { operation: 'add', a: 5, b: 3 }
});

// With context for agentic tools
const result = await agent.callTool({
  tool: 'weather_lookup',
  context: 'What is the weather in New York City?'
});
```

##### `callTools(toolCalls)`

Execute multiple tool calls in sequence.

```typescript
const results = await agent.callTools([
  { tool: 'fetchData', arguments: { url: 'https://api.example.com/data' } },
  { tool: 'processData', arguments: { format: 'json' } }
]);
```

##### `addTool(tool)`

Add a new tool to the agent.

```typescript
agent.addTool({
  name: 'newTool',
  description: 'A new tool',
  parametersSchema: { input: { type: 'string' } },
  execute: async (args) => `Processed: ${args.input}`
});
```

##### `removeTool(toolName)`

Remove a tool from the agent.

```typescript
const removed = agent.removeTool('oldTool');
console.log(removed); // true if removed, false if not found
```

##### `getTools()`

Get all registered tools.

```typescript
const tools = agent.getTools();
tools.forEach(tool => console.log(`- ${tool.name}: ${tool.description}`));
```

##### `validateToolCall(toolCall)`

Validate a tool call before execution.

```typescript
const validation = agent.validateToolCall({
  tool: 'calculator',
  arguments: { operation: 'add', a: 5, b: 3 }
});

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

##### `getLLMService()`

Get the LLM service instance.

```typescript
const llmService = agent.getLLMService();
```

---

### Orchestrator

The `Orchestrator` class enables autonomous multi-step task execution.

#### Constructor

```typescript
const orchestrator = new Orchestrator(config: OrchestratorConfig);
```

**OrchestratorConfig Options:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `agent` | `IAgent` | Yes | - | The agent instance to orchestrate |
| `maxSteps` | `number` | No | `10` | Maximum steps to execute |
| `maxIterations` | `number` | No | `5` | Maximum planning iterations |
| `verbose` | `boolean` | No | `false` | Enable verbose logging |
| `planningTemperature` | `number` | No | `0.7` | Temperature for planning |

#### Methods

##### `execute(userQuery, systemPrompt?)`

Execute a user query by planning and running tool calls.

```typescript
const result = await orchestrator.execute(
  "Get the weather in New York and send me an email summary"
);

if (result.success) {
  console.log(result.finalResponse);
  console.log(`Completed ${result.steps.length} steps`);
} else {
  console.error('Execution failed:', result.error);
}
```

**OrchestratorResult:**

| Property | Type | Description |
|----------|------|-------------|
| `success` | `boolean` | Whether execution completed successfully |
| `finalResponse` | `string` | Final response message |
| `steps` | `ExecutionStep[]` | All executed steps |
| `state` | `OrchestratorState` | Final orchestrator state |
| `error` | `string?` | Error message if failed |

##### `getState()`

Get the current orchestrator state.

```typescript
const state = orchestrator.getState();
console.log(`Status: ${state.status}`);
console.log(`Steps completed: ${state.steps.filter(s => s.completed).length}`);
console.log(`Current step: ${state.currentStepIndex}`);
```

##### `reset()`

Reset the orchestrator state.

```typescript
orchestrator.reset();
```

##### `continue()`

Continue execution from the current state (useful for resuming after errors).

```typescript
try {
  await orchestrator.execute("Complex task");
} catch (error) {
  // Fix the issue
  const result = await orchestrator.continue();
}
```

---

## Tools

### Creating Tools

Use the `createTool` helper function for type-safe tool creation:

```typescript
import { createTool } from 'agent-builder';

const weatherTool = createTool(
  'get_weather',                    // name
  'Get current weather for a city', // description
  {                                 // parameters schema
    city: { 
      type: 'string', 
      description: 'City name' 
    },
    units: { 
      type: 'string', 
      enum: ['celsius', 'fahrenheit'],
      description: 'Temperature units'
    }
  },
  async ({ city, units }) => {      // execute function
    // Your implementation here
    return { temperature: 22, condition: 'sunny', city };
  },
  { agentic: true }                 // options
);
```

### Tool Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentic` | `boolean` | `false` | Enable LLM parameter extraction |
| `validate` | `boolean` | `true` | Validate parameters before execution |
| `systemPrompt` | `string` | - | System prompt for agentic tools |

### Parameter Schema (OpenAPI Style)

The library supports OpenAPI 3.0 style schemas for parameter validation:

```typescript
const schema = {
  type: 'object',
  properties: {
    name: { 
      type: 'string', 
      description: 'User name',
      minLength: 1,
      maxLength: 100
    },
    age: { 
      type: 'integer',
      minimum: 0,
      maximum: 150
    },
    email: {
      type: 'string',
      format: 'email'
    },
    role: {
      type: 'string',
      enum: ['admin', 'user', 'guest']
    },
    tags: {
      type: 'array',
      items: { type: 'string' }
    },
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' }
      },
      required: ['street']
    }
  },
  required: ['name', 'email']
};
```

**Supported Types:**
- `string` - Text values (supports `minLength`, `maxLength`, `enum`, `format`)
- `number` - Floating point numbers (supports `minimum`, `maximum`)
- `integer` - Whole numbers (supports `minimum`, `maximum`)
- `boolean` - True/false values
- `array` - Arrays (supports `items` for item schema)
- `object` - Nested objects (supports `properties`, `required`)

### Agentic Tools

Agentic tools can extract parameters from natural language context:

```typescript
const emailTool = createTool(
  'send_email',
  'Sends an email to a recipient',
  {
    to: { type: 'string', description: 'Recipient email address' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body content' }
  },
  async ({ to, subject, body }) => {
    // Send the email
    return { success: true, messageId: '12345' };
  },
  { 
    agentic: true,
    systemPrompt: 'Extract email details from the user request. Be professional and concise.'
  }
);

// Can be called with just context - parameters are extracted by LLM
await agent.callTool({
  tool: 'send_email',
  context: 'Send an email to john@example.com about the meeting tomorrow at 3pm'
});
```

---

## Advanced Usage

### Custom LLM Providers

Use any OpenAI-compatible API:

```typescript
const llmService = new LLMService({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-llm-provider.com/v1',
  model: 'your-model-name'
});
```

### Step Dependencies

When the orchestrator creates plans, it handles step dependencies:

```typescript
// The orchestrator automatically manages dependencies like:
// Step 1: Get weather data
// Step 2: Format the data (depends on Step 1)
// Step 3: Send email with formatted data (depends on Step 2)
```

### Verbose Logging

Enable verbose logging for debugging:

```typescript
const agent = new Agent({
  tools: [...],
  llmService: llmService,
  verbose: true  // Logs all operations with timestamps
});

const orchestrator = new Orchestrator({
  agent: agent,
  verbose: true  // Logs planning and execution details
});
```

### Custom Error Recovery

The orchestrator can regenerate plans when steps fail:

```typescript
const result = await orchestrator.execute("Complex task");

// The orchestrator will:
// 1. Generate initial plan
// 2. Execute steps
// 3. If a step fails, regenerate plan with completed step context
// 4. Continue execution with new plan
// 5. Retry up to maxPlanRegenerations times (default: 3)
```

---

## Error Handling

The library provides specific error classes for different components:

### AgentError

Thrown by the Agent for tool-related errors:

```typescript
import { AgentError } from 'agent-builder';

try {
  await agent.callTool({ tool: 'unknown_tool', arguments: {} });
} catch (error) {
  if (error instanceof AgentError) {
    console.log('Tool name:', error.toolName);
    console.log('Retry count:', error.retryCount);
    console.log('Message:', error.message);
  }
}
```

### LLMServiceError

Thrown by the LLMService for API-related errors:

```typescript
import { LLMServiceError } from 'agent-builder';

try {
  await llmService.getResponse("Hello");
} catch (error) {
  if (error instanceof LLMServiceError) {
    console.log('Operation:', error.operation);
    console.log('Status code:', error.statusCode);
    console.log('Cause:', error.cause);
  }
}
```

### OrchestratorError

Thrown by the Orchestrator for execution errors:

```typescript
import { OrchestratorError } from 'agent-builder';

try {
  await orchestrator.execute("Task");
} catch (error) {
  if (error instanceof OrchestratorError) {
    console.log('Step number:', error.stepNumber);
    console.log('Message:', error.message);
  }
}
```

---

## Best Practices

### 1. Tool Design

- **Keep tools focused**: Each tool should do one thing well
- **Provide clear descriptions**: Help the LLM understand when to use each tool
- **Use detailed parameter descriptions**: Especially important for agentic tools
- **Validate inputs**: Use schemas to catch errors early

```typescript
// Good: Focused, well-described tool
const getUserTool = createTool(
  'get_user',
  'Retrieves user information by their unique ID or email address',
  {
    identifier: {
      type: 'string',
      description: 'User ID (format: usr_xxx) or email address'
    }
  },
  async ({ identifier }) => { /* ... */ }
);

// Avoid: Overly broad tool
const doEverythingTool = createTool(
  'manage_user',
  'Manages users',
  { action: { type: 'string' }, data: { type: 'object' } },
  async ({ action, data }) => { /* ... */ }
);
```

### 2. Schema Design

- **Be specific with types**: Use `integer` vs `number` appropriately
- **Add constraints**: Use `minimum`, `maximum`, `minLength`, etc.
- **Use enums**: Restrict values to valid options
- **Mark required fields**: Clearly indicate which fields are mandatory

### 3. Error Handling

- **Always wrap calls in try-catch**: Handle errors gracefully
- **Check result.success**: The orchestrator returns success status
- **Log errors appropriately**: Use verbose mode during development

```typescript
const result = await orchestrator.execute(userQuery);

if (!result.success) {
  logger.error('Orchestrator failed:', {
    error: result.error,
    completedSteps: result.steps.length,
    lastStep: result.steps[result.steps.length - 1]
  });
}
```

### 4. Performance

- **Limit max steps**: Prevent infinite loops with reasonable limits
- **Use appropriate temperatures**: Lower for consistency, higher for creativity
- **Cache LLM responses**: If making repeated similar requests

### 5. Security

- **Validate all inputs**: Never trust user/LLM-provided data
- **Sanitize tool outputs**: Especially when dealing with external services
- **Secure API keys**: Use environment variables, never hardcode

```typescript
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!,
  // ...
});
```

---

## Complete Example

Here's a complete example putting everything together:

```typescript
import {
  LLMService,
  Agent,
  Orchestrator,
  createTool
} from 'agent-builder';

// Create LLM Service
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
  temperature: 0.7
});

// Create tools
const fetchWeatherTool = createTool(
  'fetch_weather',
  'Fetches current weather data for a location',
  {
    location: { type: 'string', description: 'City name or coordinates' }
  },
  async ({ location }) => {
    // Simulated API call
    return {
      location,
      temperature: 22,
      condition: 'partly cloudy',
      humidity: 65
    };
  },
  { agentic: true }
);

const sendNotificationTool = createTool(
  'send_notification',
  'Sends a notification message to a user',
  {
    userId: { type: 'string', description: 'User ID to notify' },
    message: { type: 'string', description: 'Notification message' },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description: 'Message priority level'
    }
  },
  async ({ userId, message, priority }) => {
    console.log(`Sending ${priority} notification to ${userId}: ${message}`);
    return { success: true, notificationId: Date.now().toString() };
  },
  { agentic: true }
);

const calculateTool = createTool(
  'calculate',
  'Performs mathematical calculations',
  {
    expression: { type: 'string', description: 'Mathematical expression to evaluate' }
  },
  async ({ expression }) => {
    // Simple eval (use a proper math library in production!)
    const result = eval(expression);
    return { expression, result };
  }
);

// Create Agent
const agent = new Agent({
  tools: [fetchWeatherTool, sendNotificationTool, calculateTool],
  llmService,
  maxRetries: 3,
  retryDelay: 1000,
  verbose: true
});

// Create Orchestrator
const orchestrator = new Orchestrator({
  agent,
  maxSteps: 10,
  maxIterations: 5,
  verbose: true,
  planningTemperature: 0.7
});

// Execute a complex task
async function main() {
  try {
    const result = await orchestrator.execute(
      "Check the weather in San Francisco, and if it's sunny, send a high priority notification to user_123 suggesting they go for a walk"
    );

    console.log('\n=== Execution Complete ===');
    console.log('Success:', result.success);
    console.log('Final Response:', result.finalResponse);
    console.log('\nSteps Executed:');
    result.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.description}`);
      console.log(`     Tool: ${step.toolCall.tool}`);
      console.log(`     Result: ${JSON.stringify(step.result)}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

---

## TypeScript Support

The library is written in TypeScript and provides full type definitions. All interfaces and types are exported:

```typescript
import type {
  // LLM Service types
  LLMConfig,
  LLMResponse,
  StructuredLLMResponse,
  StructuredOutputRequest,
  ReasoningRequest,
  LLMUsage,
  ChatMessage,
  
  // Agent types
  Tool,
  ToolCall,
  AgentConfig,
  
  // Orchestrator types
  OrchestratorConfig,
  OrchestratorState,
  OrchestratorResult,
  OrchestratorStatus,
  ExecutionStep,
  
  // Schema types
  OpenAPISchema,
  OpenAPISchemaProperty,
  ParametersSchema,
  
  // Interfaces
  ILLMService,
  IAgent,
  IOrchestrator
} from 'agent-builder';
```

---

## License

MIT License

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## Support

For issues and feature requests, please open an issue on GitHub.
