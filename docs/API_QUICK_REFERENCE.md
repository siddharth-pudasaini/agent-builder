# API Quick Reference

Quick reference card for all Agent Builder library APIs.

---

## LLMService

```typescript
import { LLMService, createLLMService } from 'agent-builder';
```

### Constructor

```typescript
new LLMService({
  apiKey: string,           // Required
  baseUrl?: string,         // Default: 'https://api.openai.com/v1'
  model?: string,           // Default: 'gpt-4.1-2025-04-14'
  temperature?: number,     // Default: 0.7 (range: 0-1)
  maxTokens?: number        // Default: 1000
})
```

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getResponse()` | `prompt: string, options?: {...}` | `Promise<LLMResponse>` | Get text response |
| `getStructuredOutput<T>()` | `request: StructuredOutputRequest` | `Promise<StructuredLLMResponse<T>>` | Get structured data |
| `getReasoningResponse()` | `request: ReasoningRequest` | `Promise<LLMResponse \| StructuredLLMResponse>` | Get reasoning response |
| `validateStructuredOutput<T>()` | `content: string, schema: Record<string, unknown>` | `{isValid, data?, errors?}` | Validate content |
| `getConfig()` | - | `Required<LLMConfig>` | Get configuration |

---

## Agent

```typescript
import { Agent, createTool } from 'agent-builder';
```

### Constructor

```typescript
new Agent({
  tools: Tool[],            // Required
  llmService: ILLMService,  // Required
  maxRetries?: number,      // Default: 3
  retryDelay?: number,      // Default: 1000 (ms)
  verbose?: boolean         // Default: false
})
```

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `callTool()` | `toolCall: ToolCall` | `Promise<unknown>` | Execute single tool |
| `callTools()` | `toolCalls: ToolCall[]` | `Promise<unknown[]>` | Execute multiple tools |
| `addTool()` | `tool: Tool` | `void` | Add new tool |
| `removeTool()` | `toolName: string` | `boolean` | Remove tool |
| `getTools()` | - | `Tool[]` | Get all tools |
| `validateToolCall()` | `toolCall: ToolCall` | `{valid, errors?}` | Validate tool call |
| `getLLMService()` | - | `ILLMService` | Get LLM service |

### createTool Helper

```typescript
createTool<TArgs, TResult>(
  name: string,
  description: string,
  parametersSchema: ParametersSchema,
  execute: (args: TArgs) => Promise<TResult>,
  options?: {
    agentic?: boolean,
    validate?: boolean,
    systemPrompt?: string
  }
): Tool
```

---

## Orchestrator

```typescript
import { Orchestrator, createOrchestrator } from 'agent-builder';
```

### Constructor

```typescript
new Orchestrator({
  agent: IAgent,                // Required
  maxSteps?: number,            // Default: 10
  maxIterations?: number,       // Default: 5
  verbose?: boolean,            // Default: false
  planningTemperature?: number  // Default: 0.7
})
```

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `execute()` | `userQuery: string, systemPrompt?: string` | `Promise<OrchestratorResult>` | Execute query |
| `getState()` | - | `OrchestratorState` | Get current state |
| `reset()` | - | `void` | Reset state |
| `continue()` | - | `Promise<OrchestratorResult>` | Continue execution |

---

## Types Quick Reference

### Tool

```typescript
interface Tool {
  name: string;
  description: string;
  parametersSchema: ParametersSchema;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  agentic?: boolean;
  systemPrompt?: string;
  validate?: boolean;
}
```

### ToolCall

```typescript
interface ToolCall {
  tool: string;
  arguments?: Record<string, unknown>;
  context?: string;
}
```

### OrchestratorResult

```typescript
interface OrchestratorResult {
  success: boolean;
  finalResponse: string;
  steps: ExecutionStep[];
  state: OrchestratorState;
  error?: string;
}
```

### ExecutionStep

```typescript
interface ExecutionStep {
  stepNumber: number;
  description: string;
  toolCall: ToolCall;
  completed: boolean;
  result?: unknown;
  error?: string;
  dependsOn?: number[];
}
```

### OrchestratorStatus

```typescript
type OrchestratorStatus = 'idle' | 'planning' | 'executing' | 'completed' | 'error';
```

---

## Schema Types

### OpenAPI Schema Property

```typescript
interface OpenAPISchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: OpenAPISchemaProperty;
  properties?: Record<string, OpenAPISchemaProperty>;
  required?: string[];
  enum?: (string | number)[];
  default?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}
```

### Simplified Schema

```typescript
// Shorthand format (auto-converted to OpenAPI format)
const schema = {
  name: 'string',
  age: 'number',
  isActive: 'boolean'
};

// Is equivalent to:
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    isActive: { type: 'boolean' }
  },
  required: ['name', 'age', 'isActive']
};
```

---

## Error Classes

| Error Class | Properties | Thrown By |
|-------------|------------|-----------|
| `AgentError` | `toolName?: string`, `retryCount?: number` | Agent |
| `LLMServiceError` | `operation?: string`, `statusCode?: number`, `cause?: unknown` | LLMService |
| `OrchestratorError` | `stepNumber?: number` | Orchestrator |

---

## Imports Cheatsheet

```typescript
// Classes
import { LLMService, Agent, Orchestrator } from 'agent-builder';

// Factory functions
import { createLLMService, createTool, createOrchestrator } from 'agent-builder';

// Error classes
import { AgentError, LLMServiceError, OrchestratorError } from 'agent-builder';

// Types
import type {
  // LLM
  LLMConfig,
  LLMResponse,
  StructuredLLMResponse,
  StructuredOutputRequest,
  ReasoningRequest,
  LLMUsage,
  ChatMessage,
  
  // Agent
  Tool,
  ToolCall,
  AgentConfig,
  
  // Orchestrator
  OrchestratorConfig,
  OrchestratorState,
  OrchestratorResult,
  OrchestratorStatus,
  ExecutionStep,
  
  // Schema
  OpenAPISchema,
  OpenAPISchemaProperty,
  ParametersSchema,
  
  // Interfaces
  ILLMService,
  IAgent,
  IOrchestrator
} from 'agent-builder';
```
