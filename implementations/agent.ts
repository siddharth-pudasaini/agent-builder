/**
 * Agent Implementation
 *
 * Concrete implementation of the IAgent interface.
 * A TypeScript library for building AI agents with tool calling capabilities,
 * retries, and human-readable logging.
 *
 * @class Agent
 * @implements {IAgent}
 */

import { Tool, ToolCall, AgentConfig, AgentError } from "../types/agent.types";
import { ParametersSchema } from "../types/openAPISpec.types";
import { IAgent } from "../interfaces/agent.interface";
import { ILLMService } from "../interfaces/llmService.interface";
import { StructuredOutputRequest } from "../types/llmService.types";
import {
  normalizeToOpenAPISchema,
  validateAgainstSchema,
} from "../utils/openApiSpec";

/**
 * Agent class for managing and executing tools
 *
 * Provides methods for managing tools and executing tool calls
 * with retry logic, validation, and agentic capabilities.
 * Uses dependency injection to require an LLM service instance.
 *
 * @class Agent
 * @implements {IAgent}
 */
export class Agent implements IAgent {
  /** Map of registered tools by name */
  private readonly tools: Map<string, Tool>;

  /** Maximum number of retry attempts */
  private readonly maxRetries: number;

  /** Delay between retry attempts in milliseconds */
  private readonly retryDelay: number;

  /** Whether verbose logging is enabled */
  private readonly verbose: boolean;

  /** Injected LLM service instance */
  private readonly llmService: ILLMService;

  /**
   * Creates an instance of Agent
   *
   * @param {AgentConfig} config - Configuration object with tools and settings
   * @throws {AgentError} When no tools are provided or duplicate tool names exist
   *
   * @example
   * ```typescript
   * const agent = new Agent({
   *   tools: [calculatorTool, weatherTool],
   *   llmService: llmServiceInstance,
   *   maxRetries: 3,
   *   verbose: true
   * });
   * ```
   */
  constructor(config: AgentConfig) {
    if (!config.tools?.length) {
      throw new AgentError("Agent requires at least one tool to be configured");
    }

    if (!config.llmService) {
      throw new AgentError("Agent requires an LLM service instance");
    }

    this.tools = new Map();
    config.tools.forEach((tool) => {
      if (this.tools.has(tool.name)) {
        throw new AgentError(`Duplicate tool name detected: '${tool.name}'`);
      }
      this.tools.set(tool.name, tool);
    });

    this.maxRetries = Math.max(1, config.maxRetries ?? 3);
    this.retryDelay = Math.max(0, config.retryDelay ?? 1000);
    this.verbose = config.verbose ?? false;
    this.llmService = config.llmService;
  }

  /**
   * Log a message with timestamp and level
   *
   * @private
   * @param {string} message - The message to log
   * @param {('info' | 'warn' | 'error')} [level='info'] - Log level
   */
  private log(
    message: string,
    level: "info" | "warn" | "error" = "info"
  ): void {
    if (!this.verbose) return;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [Agent] ${message}`);
  }

  /**
   * Sleep for a specified duration
   *
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>} Promise that resolves after the delay
   */
  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get a tool by name
   *
   * @private
   * @param {string} toolName - Name of the tool to retrieve
   * @returns {Tool} The tool instance
   * @throws {AgentError} When tool is not found
   */
  private getTool(toolName: string): Tool {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new AgentError(`Tool '${toolName}' not found`, toolName);
    }
    return tool;
  }

  /**
   * Generate structured data for an agentic tool using LLM
   *
   * @private
   * @param {Tool} tool - The agentic tool to generate parameters for
   * @param {string} userInput - User input to extract parameters from
   * @returns {Promise<Record<string, unknown>>} Generated parameters matching tool schema
   * @throws {AgentError} When LLM service fails or generates invalid data
   */
  /**
   * Convert OpenAPI schema to simplified JSON schema for LLM structured output
   * LLM service expects a simple format: Record<string, string>
   *
   * @private
   * @param {ParametersSchema} schema - The parameters schema
   * @returns {Record<string, unknown>} Simplified JSON schema for LLM
   */
  private getJsonSchema(schema: ParametersSchema): Record<string, unknown> {
    const openAPISchema = normalizeToOpenAPISchema(schema);
    const simplified: Record<string, unknown> = {};

    for (const [key, property] of Object.entries(openAPISchema.properties)) {
      // Convert OpenAPI property to simple type string for LLM
      if (property.type === "integer") {
        simplified[key] = "number";
      } else if (property.type === "array" && property.items) {
        simplified[key] = "array";
      } else if (property.type === "object" && property.properties) {
        // Recursively convert nested objects
        const nestedSchema: Record<string, unknown> = {};
        for (const [nestedKey, nestedProp] of Object.entries(
          property.properties
        )) {
          nestedSchema[nestedKey] =
            nestedProp.type === "integer" ? "number" : nestedProp.type;
        }
        simplified[key] = nestedSchema;
      } else {
        simplified[key] = property.type;
      }
    }

    return simplified;
  }

  /**
   * Build parameter descriptions from OpenAPI schema for LLM prompts
   *
   * @private
   * @param {ParametersSchema} schema - The parameters schema
   * @returns {string} Formatted parameter descriptions
   */
  private buildParameterDescriptions(schema: ParametersSchema): string {
    const openAPISchema = normalizeToOpenAPISchema(schema);
    const requiredFields = openAPISchema.required || [];

    return Object.entries(openAPISchema.properties)
      .map(([name, property]) => {
        const isRequired = requiredFields.includes(name);
        const typeDesc = property.type === "integer" ? "number" : property.type;
        const desc = property.description ? ` - ${property.description}` : "";
        const required = isRequired ? " (required)" : " (optional)";
        const enumDesc = property.enum
          ? ` - one of: ${property.enum.join(", ")}`
          : "";
        return `- ${name}: ${typeDesc}${required}${desc}${enumDesc}`;
      })
      .join("\n");
  }

  private async generateStructuredDataForTool(
    tool: Tool,
    distilledContext: string
  ): Promise<Record<string, unknown>> {
    try {
      // Get JSON schema for LLM
      const hasSystemPrompt = tool.systemPrompt && tool.systemPrompt.length > 0;
      const jsonSchema = this.getJsonSchema(tool.parametersSchema);

      // Build parameter descriptions from OpenAPI schema
      const parameterDescriptions = this.buildParameterDescriptions(
        tool.parametersSchema
      );

      const simplePrompt = `Extract the following parameters from the provided context:

Required Parameters:
${parameterDescriptions}

${hasSystemPrompt ? `SYSTEM PROMPT: ` + tool.systemPrompt : ""}

Context:
${distilledContext}

Extract and return all parameters as JSON matching the strict schema. Ensure all required parameters are present and correctly typed.`;

      const request: StructuredOutputRequest = {
        prompt: simplePrompt,
        schema: jsonSchema,
        description: `Extract parameters for ${tool.name}`,
        temperatureOverride: 0.1,
      };

      const response = await this.llmService.getStructuredOutput(request);

      if (!response.isValid) {
        throw new AgentError(
          `Failed to generate valid structured data for tool '${
            tool.name
          }': ${response.validationErrors?.join(", ")}`,
          tool.name
        );
      }

      const extractedData =
        (response.structuredData as Record<string, unknown>) || {};

      // Strictly validate extracted data against schema
      const validationResult = validateAgainstSchema(
        extractedData,
        tool.parametersSchema
      );

      if (!validationResult.isValid) {
        const errors =
          validationResult.errors?.join(", ") || "Unknown validation error";
        throw new AgentError(
          `Extracted data failed strict validation for tool '${tool.name}': ${errors}`,
          tool.name
        );
      }

      // Use validated data
      const validatedData = validationResult.data || {};

      // Log extracted parameters for debugging
      if (this.verbose) {
        this.log(
          `Extracted and validated parameters for '${
            tool.name
          }': ${JSON.stringify(validatedData)}`
        );
      }
      return validatedData;
    } catch (error) {
      throw new AgentError(
        `LLM service error for tool '${tool.name}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        tool.name
      );
    }
  }

  /**
   * Regenerate structured data for an agentic tool using LLM with error feedback
   *
   * This function is used during retries when a tool call fails. It includes
   * the error information to help the LLM generate better structured data.
   *
   * @private
   * @param {Tool} tool - The agentic tool to generate parameters for
   * @param {string} context - Original context to extract parameters from
   * @param {Error} error - The error from the previous failed attempt
   * @returns {Promise<Record<string, unknown>>} Generated parameters matching tool schema
   * @throws {AgentError} When LLM service fails or generates invalid data
   */
  private async regenerateStructuredDataWithError(
    tool: Tool,
    context: string,
    error: Error
  ): Promise<Record<string, unknown>> {
    try {
      // Get JSON schema for LLM
      const jsonSchema = this.getJsonSchema(tool.parametersSchema);

      // Build parameter descriptions from OpenAPI schema
      const parameterDescriptions = this.buildParameterDescriptions(
        tool.parametersSchema
      );

      const errorMessage = error.message || String(error);

      const retryPrompt = `Extract the following parameters from the provided context. A previous attempt failed with an error - use this information to generate better parameters:

Required Parameters:
${parameterDescriptions}

Context:
${context}

Previous Error:
${errorMessage}

Extract and return all parameters as JSON matching the strict schema. Ensure all required parameters are present and correctly typed. Consider the error message to avoid similar issues.`;

      const request: StructuredOutputRequest = {
        prompt: retryPrompt,
        schema: jsonSchema,
        description: `Regenerate parameters for ${tool.name} with error feedback`,
        temperatureOverride: 0.1,
        modelOverride: "gpt-4o-mini", // Use mini model for cost efficiency
      };

      const response = await this.llmService.getStructuredOutput(request);

      if (!response.isValid) {
        throw new AgentError(
          `Failed to regenerate valid structured data for tool '${
            tool.name
          }': ${response.validationErrors?.join(", ")}`,
          tool.name
        );
      }

      const extractedData =
        (response.structuredData as Record<string, unknown>) || {};

      // Always strictly validate extracted data against schema
      const validationResult = validateAgainstSchema(
        extractedData,
        tool.parametersSchema
      );

      if (!validationResult.isValid) {
        const errors =
          validationResult.errors?.join(", ") || "Unknown validation error";
        throw new AgentError(
          `Regenerated data failed strict validation for tool '${tool.name}': ${errors}`,
          tool.name
        );
      }

      // Use validated data
      const validatedData = validationResult.data || {};

      // Log regenerated parameters for debugging
      if (this.verbose) {
        this.log(
          `Regenerated and validated parameters for '${
            tool.name
          }' after error: ${JSON.stringify(validatedData)}`
        );
      }

      return validatedData;
    } catch (error) {
      throw new AgentError(
        `LLM service error while regenerating data for tool '${tool.name}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        tool.name
      );
    }
  }

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
  async callTool(
    toolCall: ToolCall,
    orchestratorCall: boolean = false
  ): Promise<unknown> {
    const { tool: toolName, arguments: args = {}, context } = toolCall;
    this.log(
      `Calling tool ${toolName} with args: ${JSON.stringify(
        args
      )} and context: ${context}\n`
    );
    const tool = this.getTool(toolName);
    let lastError: Error | null = null;

    // Ensure either arguments or context is provided
    const hasArguments = Object.keys(args).length > 0;
    const hasContext = !!context;

    if (!hasArguments && !hasContext) {
      throw new AgentError(
        `Tool call for '${toolName}' requires either 'arguments' or 'context' to be provided`,
        toolName
      );
    }

    // Handle agentic tool calls
    let finalArgs = args;

    // If arguments are provided, use them directly (precedence)
    // Only generate from context if:
    // 1. Tool is agentic
    // 2. No arguments provided
    // 3. Context is provided
    if ((tool.agentic && !hasArguments && hasContext) || orchestratorCall) {
      this.log(
        `Generating structured data for agentic tool '${toolName}' from context`
      );

      try {
        const generatedArgs = await this.generateStructuredDataForTool(
          tool,
          context || "Generate Arguments for the given tool."
        );

        finalArgs = generatedArgs;

        // Validation is already done in generateStructuredDataForTool
        // If validation fails there, it will throw an error
      } catch (extractionError) {
        throw new AgentError(
          `Failed to extract parameters for agentic tool '${toolName}': ${
            extractionError instanceof Error
              ? extractionError.message
              : String(extractionError)
          }`,
          toolName
        );
      }
    } else if (tool.agentic && hasArguments) {
      // Arguments provided for agentic tool - use them directly (precedence)
      this.log(
        `Using provided arguments for agentic tool '${toolName}' (skipping context extraction)`
      );
      finalArgs = args;
    } else if (tool.agentic && !hasContext) {
      // Agentic tool but no context and no arguments
      throw new AgentError(
        `Agentic tool '${toolName}' requires either 'arguments' or 'context' to be provided`,
        toolName
      );
    }

    // Strictly validate using schema (always validate, validate flag controls strictness)
    const validationResult = validateAgainstSchema(
      finalArgs,
      tool.parametersSchema
    );

    if (!validationResult.isValid) {
      const errors =
        validationResult.errors?.join(", ") || "Unknown validation error";
      throw new AgentError(
        `Tool call validation failed for '${toolName}': ${errors}`,
        toolName
      );
    }

    // Use validated data
    finalArgs = validationResult.data || finalArgs;

    // Track if we need to regenerate data on retry (agentic tool with context, no explicit arguments)
    const shouldRegenerateOnRetry = tool.agentic && !hasArguments && hasContext;

    // Retry logic
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // If this is a retry attempt and we should regenerate, do so with error feedback
        if (attempt > 1 && shouldRegenerateOnRetry && lastError) {
          this.log(
            `Regenerating structured data for agentic tool '${toolName}' with error feedback (attempt ${attempt})`
          );

          try {
            const regeneratedArgs =
              await this.regenerateStructuredDataWithError(
                tool,
                context!,
                lastError
              );

            // Always validate regenerated data
            const regeneratedValidationResult = validateAgainstSchema(
              regeneratedArgs,
              tool.parametersSchema
            );

            if (!regeneratedValidationResult.isValid) {
              const errors =
                regeneratedValidationResult.errors?.join(", ") ||
                "Unknown validation error";
              throw new AgentError(
                `Regenerated data validation failed for '${toolName}': ${errors}`,
                toolName
              );
            }

            // Use validated regenerated data
            finalArgs = regeneratedValidationResult.data || regeneratedArgs;

            this.log(
              `Using regenerated parameters for '${toolName}' on attempt ${attempt}`
            );
          } catch (regenerationError) {
            this.log(
              `Failed to regenerate data for '${toolName}': ${
                regenerationError instanceof Error
                  ? regenerationError.message
                  : String(regenerationError)
              }`,
              "error"
            );
            // Continue with previous args if regeneration fails
          }
        }

        if (tool.agentic) {
          this.log(
            `Attempt ${attempt}/${this.maxRetries}: Calling agentic tool '${toolName}' with parameters`
          );
        } else {
          this.log(
            `Attempt ${attempt}/${this.maxRetries}: Calling tool '${toolName}'`
          );
        }

        const result = await tool.execute(finalArgs);

        this.log(`Tool '${toolName}' executed successfully`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(
          `Tool '${toolName}' failed on attempt ${attempt}: ${lastError.message}`,
          "error"
        );

        if (attempt < this.maxRetries) {
          this.log(`Retrying in ${this.retryDelay}ms...`);
          await this.sleep(this.retryDelay);
        }
      }
    }

    throw new AgentError(
      `Tool '${toolName}' failed after ${this.maxRetries} attempts: ${lastError?.message}`,
      toolName,
      this.maxRetries
    );
  }

  /**
   * Execute multiple tool calls in sequence
   *
   * @param {ToolCall[]} toolCalls - Array of tool calls to execute
   * @param {string} [userInput] - Optional user input for agentic tools
   * @returns {Promise<unknown[]>} Promise resolving to array of execution results
   * @throws {AgentError} When any tool execution fails
   *
   * @example
   * ```typescript
   * const results = await agent.callTools([
   *   { tool: 'fetchData', arguments: { url: 'https://api.example.com' } },
   *   { tool: 'processData', arguments: { data: results[0] } }
   * ]);
   * ```
   */
  async callTools(
    toolCalls: ToolCall[],
    orchestratorCall: boolean = false
  ): Promise<unknown[]> {
    const results: unknown[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.callTool(toolCall);
        results.push(result);
      } catch (error) {
        if (error instanceof AgentError) {
          throw error;
        }
        throw new AgentError(
          `Unexpected error in tool chain: ${String(error)}`
        );
      }
    }

    return results;
  }

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
   *   parameters: { param1: 'string' },
   *   execute: async (args) => { return 'result'; }
   * });
   * ```
   */
  addTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new AgentError(`Tool '${tool.name}' already exists`);
    }
    this.tools.set(tool.name, tool);
    this.log(`Added tool '${tool.name}'`);
  }

  /**
   * Remove a tool from the agent
   *
   * @param {string} toolName - The name of the tool to remove
   * @returns {boolean} True if the tool was removed, false if it didn't exist
   *
   * @example
   * ```typescript
   * const removed = agent.removeTool('oldTool');
   * if (removed) {
   *   console.log('Tool removed successfully');
   * }
   * ```
   */
  removeTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName);
    if (removed) {
      this.log(`Removed tool '${toolName}'`);
    }
    return removed;
  }

  /**
   * Get all available tools
   *
   * @returns {Tool[]} Array of all registered tools
   *
   * @example
   * ```typescript
   * const tools = agent.getTools();
   * console.log(`Agent has ${tools.length} tools`);
   * tools.forEach(tool => console.log(`- ${tool.name}`));
   * ```
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

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
   *   console.error('Validation errors:', validation.errors);
   * }
   * ```
   */
  validateToolCall(toolCall: ToolCall): {
    valid: boolean;
    errors?: string[];
  } {
    const { tool: toolName, arguments: args = {} } = toolCall;
    const errors: string[] = [];

    if (!this.tools.has(toolName)) {
      errors.push(`Tool '${toolName}' not found`);
      return { valid: false, errors };
    }

    const tool = this.tools.get(toolName)!;

    // Use schema for strict validation
    const validationResult = validateAgainstSchema(args, tool.parametersSchema);

    if (!validationResult.isValid) {
      errors.push(...(validationResult.errors || []));
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

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
  getLLMService(): ILLMService {
    return this.llmService;
  }
}

/**
 * Helper function to create a tool with type safety using JSON schemas
 *
 * @template TArgs - Type of the tool arguments
 * @template TResult - Type of the tool result
 * @param {string} name - Unique name for the tool
 * @param {string} description - Human-readable description
 * @param {ParametersSchema} parametersSchema - JSON schema for strict parameter validation
 * @param {(args: TArgs) => Promise<TResult>} execute - Tool execution function
 * @param {Object} [options] - Optional tool configuration
 * @param {boolean} [options.agentic] - Whether this is an agentic tool
 * @param {boolean} [options.validate] - Whether to validate parameters (default: true, always enforced)
 * @returns {Tool} Created tool instance
 *
 * @example
 * ```typescript
 * const calculatorTool = createTool(
 *   'calculator',
 *   'Performs arithmetic operations',
 *   {
 *     operation: 'string',
 *     a: 'number',
 *     b: 'number',
 *   },
 *   async ({ operation, a, b }) => {
 *     // implementation
 *   },
 *   { agentic: true }
 * );
 * ```
 */
export function createTool<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown
>(
  name: string,
  description: string,
  parametersSchema: ParametersSchema,
  execute: (args: TArgs) => Promise<TResult>,
  options?: { agentic?: boolean; validate?: boolean; systemPrompt?: string }
): Tool {
  return {
    name,
    description,
    parametersSchema,
    execute: execute as (args: unknown) => Promise<unknown>,
    agentic: options?.agentic ?? false,
    validate: options?.validate ?? true, // Default to true for strict validation
    systemPrompt: options?.systemPrompt ?? undefined,
  };
}

/**
 * Create a new agent with the given configuration
 *
 * @param {AgentConfig} config - Configuration object with tools and settings
 * @returns {Agent} New Agent instance
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   tools: [calculatorTool, weatherTool],
 *   llmService: llmServiceInstance,
 *   maxRetries: 3,
 *   verbose: true
 * });
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}

// Re-export types for convenience
export type { Tool, ToolCall, AgentConfig };
export { AgentError };
