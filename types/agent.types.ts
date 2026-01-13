/**
 * Agent Type Definitions
 *
 * Contains all type definitions, interfaces, and enums used by the Agent.
 * These types define the structure of tools, tool calls, and agent configuration.
 */

import { ILLMService } from "../interfaces/llmService.interface";
import { ParametersSchema } from "./openAPISpec.types";

/**
 * Tool definition interface
 *
 * @interface Tool
 * @property {string} name - Unique identifier for the tool
 * @property {string} description - Human-readable description of what the tool does
 * @property {ParametersSchema} parametersSchema - JSON schema defining expected arguments (strict validation)
 * @property {(args: Record<string, unknown>) => Promise<unknown>} execute - Function to execute the tool
 * @property {boolean} [agentic] - Whether this tool uses LLM to generate parameters from user input
 * @property {boolean} [validate] - Whether to validate parameters before execution (default: true)
 */
export interface Tool {
  /** Unique identifier for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON schema defining expected arguments (strict validation) */
  parametersSchema: ParametersSchema;
  /** Function to execute the tool with provided arguments */
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  /** Whether this tool uses LLM to generate parameters from user input */
  agentic?: boolean;
  /**If agentic the provide the system prompt */
  systemPrompt?: string;
  /** Whether to validate parameters before execution (default: true) */
  validate?: boolean;
}

/**
 * Tool call structure
 *
 * @interface ToolCall
 * @property {string} tool - Name of the tool to call
 * @property {Record<string, unknown>} [arguments] - Arguments to pass to the tool (takes precedence over context)
 * @property {string} [context] - Context for agentic tools to extract parameters from (used only if arguments not provided)
 */
export interface ToolCall {
  /** Name of the tool to call */
  tool: string;
  /** Arguments to pass to the tool (takes precedence over context) */
  arguments?: Record<string, unknown>;
  /** Context for agentic tools to extract parameters from (used only if arguments not provided) */
  context?: string;
}

/**
 * Agent configuration
 *
 * @interface AgentConfig
 * @property {Tool[]} tools - Array of tools available to the agent (required)
 * @property {number} [maxRetries] - Maximum number of retry attempts for failed tool calls (default: 3)
 * @property {number} [retryDelay] - Delay between retry attempts in milliseconds (default: 1000)
 * @property {boolean} [verbose] - Enable verbose logging for debugging purposes (default: false)
 * @property {ILLMService} llmService - LLM service instance (required for agentic tools)
 */
export interface AgentConfig {
  /** Array of tools available to the agent */
  tools: Tool[];
  /** Maximum number of retry attempts for failed tool calls */
  maxRetries?: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay?: number;
  /** Enable verbose logging for debugging purposes */
  verbose?: boolean;
  /** LLM service instance (required for agentic tools) */
  llmService: ILLMService;
}

/**
 * Custom error class for Agent operations
 *
 * @class AgentError
 * @extends Error
 * @property {string} [toolName] - Name of the tool that caused the error
 * @property {number} [retryCount] - Number of retry attempts made before failure
 */
export class AgentError extends Error {
  /**
   * Creates an instance of AgentError
   *
   * @param {string} message - Error message
   * @param {string} [toolName] - Name of the tool that caused the error
   * @param {number} [retryCount] - Number of retry attempts made before failure
   */
  constructor(
    message: string,
    public readonly toolName?: string,
    public readonly retryCount?: number
  ) {
    super(message);
    this.name = "AgentError";
  }
}
