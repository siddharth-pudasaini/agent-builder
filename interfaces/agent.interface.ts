/**
 * Agent Interface
 *
 * Defines the contract for Agent implementations.
 * This interface provides abstraction for different agent implementations
 * and enables dependency injection and testing.
 */

import { Tool, ToolCall } from "../types/agent.types";
import { ILLMService } from "./llmService.interface";

/**
 * Interface for Agent implementations
 *
 * @interface IAgent
 * @description Provides methods for managing tools and executing tool calls
 * with retry logic, validation, and agentic capabilities.
 */
export interface IAgent {
  /**
   * Execute a tool call with retry logic and error handling
   *
   * @param {ToolCall} toolCall - The tool call to execute (contains arguments and/or context)
   * @returns {Promise<unknown>} Promise resolving to the tool execution result
   * @throws {AgentError} When tool execution fails after all retries
   *
   * @example
   * ```typescript
   * // With explicit arguments (preferred)
   * const result = await agent.callTool({
   *   tool: 'calculator',
   *   arguments: { operation: 'add', a: 5, b: 3 }
   * });
   *
   * // With context for agentic tool
   * const result = await agent.callTool({
   *   tool: 'calculator',
   *   context: 'Add 5 and 3'
   * });
   * ```
   */
  callTool(toolCall: ToolCall, orchestratorCall?: boolean): Promise<unknown>;

  /**
   * Execute multiple tool calls in sequence
   *
   * @param {ToolCall[]} toolCalls - Array of tool calls to execute (each contains arguments and/or context)
   * @returns {Promise<unknown[]>} Promise resolving to array of execution results
   * @throws {AgentError} When any tool execution fails
   *
   * @example
   * ```typescript
   * const results = await agent.callTools([
   *   { tool: 'tool1', arguments: {} },
   *   { tool: 'tool2', context: 'extract data from this' }
   * ]);
   * ```
   */
  callTools(toolCalls: ToolCall[]): Promise<unknown[]>;

  /**
   * Add a new tool to the agent
   *
   * @param {Tool} tool - The tool to add
   * @throws {AgentError} When a tool with the same name already exists
   *
   * @example
   * ```typescript
   * agent.addTool({
   *   name: 'newTool',
   *   description: 'A new tool',
   *   parameters: {},
   *   execute: async (args) => { return 'result'; }
   * });
   * ```
   */
  addTool(tool: Tool): void;

  /**
   * Remove a tool from the agent
   *
   * @param {string} toolName - The name of the tool to remove
   * @returns {boolean} True if the tool was removed, false if it didn't exist
   *
   * @example
   * ```typescript
   * agent.removeTool('oldTool');
   * ```
   */
  removeTool(toolName: string): boolean;

  /**
   * Get all available tools
   *
   * @returns {Tool[]} Array of all registered tools
   *
   * @example
   * ```typescript
   * const tools = agent.getTools();
   * console.log(`Agent has ${tools.length} tools`);
   * ```
   */
  getTools(): Tool[];

  /**
   * Validate if a tool call is valid
   *
   * @param {ToolCall} toolCall - The tool call to validate
   * @returns {Object} Validation result with valid flag and optional errors
   *
   * @example
   * ```typescript
   * const validation = agent.validateToolCall({
   *   tool: 'calculator',
   *   arguments: { operation: 'add', a: 5, b: 3 }
   * });
   * if (!validation.valid) {
   *   console.error(validation.errors);
   * }
   * ```
   */
  validateToolCall(toolCall: ToolCall): {
    valid: boolean;
    errors?: string[];
  };

  /**
   * Get the LLM service instance
   *
   * @returns {ILLMService} The LLM service instance
   *
   * @example
   * ```typescript
   * const llmService = agent.getLLMService();
   * const response = await llmService.getResponse("Hello");
   * ```
   */
  getLLMService(): ILLMService;
}
