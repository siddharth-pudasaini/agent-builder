/**
 * LLM Service Implementation
 *
 * Concrete implementation of the ILLMService interface.
 * Handles LLM interactions including structured data generation,
 * general responses, and reasoning with structured output support.
 *
 * @class LLMService
 * @implements {ILLMService}
 */

import {
  LLMConfig,
  LLMResponse,
  StructuredLLMResponse,
  StructuredOutputRequest,
  ReasoningRequest,
  LLMUsage,
  ChatMessage,
  ChatCompletionResponse,
  LLMServiceError,
} from "../types/llmService.types";
import { ILLMService } from "../interfaces/llmService.interface";

/**
 * Default LLM Service implementation
 *
 * Provides methods for interacting with Language Learning Models (LLMs)
 * including general responses, structured output generation, and reasoning capabilities.
 *
 * @class LLMService
 * @implements {ILLMService}
 */
export class LLMService implements ILLMService {
  /** Service configuration with all required fields */
  private readonly config: Required<LLMConfig>;

  /** Default model identifier */
  private static readonly DEFAULT_MODEL = "gpt-4.1-2025-04-14";

  /** Default temperature setting */
  private static readonly DEFAULT_TEMPERATURE = 0.7;

  /** Default maximum tokens */
  private static readonly DEFAULT_MAX_TOKENS = 1000;

  /**
   * Creates an instance of LLMService
   *
   * @param {LLMConfig} config - Configuration object with API key and optional settings
   * @throws {LLMServiceError} When API key is not provided
   *
   * @example
   * ```typescript
   * const llmService = new LLMService({
   *   apiKey: 'your-api-key',
   *   model: 'gpt-4',
   *   temperature: 0.8
   * });
   * ```
   */
  constructor(config: LLMConfig) {
    if (!config.apiKey) {
      throw new LLMServiceError(
        "API key is required for LLM service",
        "constructor"
      );
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || "https://api.openai.com/v1",
      model: config.model || LLMService.DEFAULT_MODEL,
      temperature: config.temperature ?? LLMService.DEFAULT_TEMPERATURE,
      maxTokens: config.maxTokens ?? LLMService.DEFAULT_MAX_TOKENS,
    };
  }

  /**
   * Get a general response from the LLM
   *
   * @param {string} prompt - The user's prompt/question
   * @param {Object} [options] - Optional configuration overrides
   * @param {number} [options.temperature] - Temperature setting for response randomness (0-1)
   * @param {number} [options.maxTokens] - Maximum tokens in the response
   * @param {string} [options.model] - Model identifier to use
   * @returns {Promise<LLMResponse>} Promise resolving to the LLM response with content and usage stats
   * @throws {LLMServiceError} When the API call fails or response is invalid
   *
   * @example
   * ```typescript
   * const response = await llmService.getResponse("What is TypeScript?", {
   *   temperature: 0.9,
   *   maxTokens: 500
   * });
   * console.log(response.content);
   * ```
   */
  async getResponse(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number; model?: string }
  ): Promise<LLMResponse> {
    try {
      const response = await this.callLLM({
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature ?? this.config.temperature,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        model: options?.model,
      });

      return {
        content: this.extractMessageContent(response),
        usage: response.usage,
      };
    } catch (error) {
      throw this.wrapError(error, "getResponse");
    }
  }

  /**
   * Get structured data from the LLM based on a schema
   *
   * @template T - The type of structured data expected (defaults to Record<string, unknown>)
   * @param {StructuredOutputRequest} request - Request configuration with prompt and schema
   * @returns {Promise<StructuredLLMResponse<T>>} Promise resolving to structured response with validation status
   * @throws {LLMServiceError} When the API call fails or structured output cannot be generated
   *
   * @example
   * ```typescript
   * const response = await llmService.getStructuredOutput({
   *   prompt: "Extract user information from: John Doe, 30 years old",
   *   schema: { name: "string", age: "number" },
   *   description: "User profile"
   * });
   * if (response.isValid) {
   *   console.log(response.structuredData);
   * } else {
   *   console.error(response.validationErrors);
   * }
   * ```
   */
  async getStructuredOutput<T = Record<string, unknown>>(
    request: StructuredOutputRequest
  ): Promise<StructuredLLMResponse<T>> {
    try {
      const systemPrompt = this.buildStructuredOutputSystemPrompt(
        request.schema,
        request.description
      );

      const response = await this.callLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.prompt },
        ],
        temperature: request.temperatureOverride ?? 0.1,
        max_tokens: request.maxTokensOverride ?? this.config.maxTokens,
        model: request.modelOverride ?? this.config.model,
      });

      const content = this.extractMessageContent(response);
      const parsed = this.safeParseStructuredOutput<T>(content, request.schema);

      return {
        content,
        structuredData: parsed.data ?? null,
        isValid: parsed.isValid,
        validationErrors: parsed.errors,
        usage: response.usage,
      };
    } catch (error) {
      throw this.wrapError(error, "getStructuredOutput");
    }
  }

  /**
   * Get reasoning response with optional structured output
   *
   * @param {ReasoningRequest} request - Request configuration with prompt, context, and optional schema
   * @returns {Promise<LLMResponse | StructuredLLMResponse>} Promise resolving to reasoning response
   * @throws {LLMServiceError} When the API call fails
   *
   * @example
   * ```typescript
   * const response = await llmService.getReasoningResponse({
   *   prompt: "Analyze the pros and cons of TypeScript",
   *   context: "For a web development project",
   *   requireStructuredOutput: true,
   *   outputSchema: {
   *     pros: "array",
   *     cons: "array",
   *     conclusion: "string"
   *   }
   * });
   * ```
   */
  async getReasoningResponse(
    request: ReasoningRequest
  ): Promise<LLMResponse | StructuredLLMResponse> {
    try {
      const systemPrompt = this.buildReasoningSystemPrompt(request);
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
      ];

      if (request.context) {
        messages.push({
          role: "system",
          content: `Context: ${request.context}`,
        });
      }

      messages.push({ role: "user", content: request.prompt });

      const response = await this.callLLM({
        messages,
        temperature: request.temperatureOverride ?? this.config.temperature,
        max_tokens: request.maxTokensOverride ?? this.config.maxTokens,
      });

      const content = this.extractMessageContent(response);

      if (request.requireStructuredOutput && request.outputSchema) {
        const parsed = this.safeParseStructuredOutput(
          content,
          request.outputSchema
        );
        return {
          content,
          structuredData: (parsed.data ?? null) as Record<
            string,
            unknown
          > | null,
          isValid: parsed.isValid,
          validationErrors: parsed.errors,
          usage: response.usage,
        };
      }

      return {
        content,
        usage: response.usage,
      };
    } catch (error) {
      throw this.wrapError(error, "getReasoningResponse");
    }
  }

  /**
   * Validate if a given text conforms to a schema
   *
   * @template T - The type of structured data expected
   * @param {string} content - The text content to validate
   * @param {Record<string, unknown>} schema - The schema to validate against
   * @returns {Object} Validation result with isValid flag and optional data/errors
   *
   * @example
   * ```typescript
   * const validation = llmService.validateStructuredOutput(
   *   '{"name": "John", "age": 30}',
   *   { name: "string", age: "number" }
   * );
   * if (validation.isValid) {
   *   console.log(validation.data);
   * }
   * ```
   */
  validateStructuredOutput<T = Record<string, unknown>>(
    content: string,
    schema: Record<string, unknown>
  ): { isValid: boolean; data?: T; errors?: string[] } {
    const parsed = this.safeParseStructuredOutput<T>(content, schema);
    return parsed.isValid
      ? { isValid: true, data: parsed.data ?? undefined }
      : { isValid: false, errors: parsed.errors };
  }

  /**
   * Low-level LLM API call
   *
   * @private
   * @param {Object} request - Request configuration
   * @param {Array} request.messages - Array of chat messages
   * @param {number} [request.temperature] - Temperature setting
   * @param {number} [request.max_tokens] - Maximum tokens
   * @param {string} [request.model] - Model identifier
   * @returns {Promise<ChatCompletionResponse>} Promise resolving to API response
   * @throws {LLMServiceError} When fetch is unavailable or API call fails
   */
  private async callLLM(request: {
    messages: Array<{ role: ChatMessage["role"]; content: string }>;
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }): Promise<ChatCompletionResponse> {
    if (typeof fetch !== "function") {
      throw new LLMServiceError(
        "Global fetch is not available in this environment",
        "callLLM"
      );
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model ?? this.config.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
      }),
    }).catch((error: unknown) => {
      throw new LLMServiceError(
        "Network error while calling LLM API",
        "callLLM",
        undefined,
        error
      );
    });

    if (!response.ok) {
      const errorBody = await this.safeReadErrorResponse(response);
      throw new LLMServiceError(
        `LLM API request failed with status ${response.status}: ${response.statusText}${errorBody}`,
        "callLLM",
        response.status
      );
    }

    return (await response.json()) as ChatCompletionResponse;
  }

  /**
   * Build system prompt for structured output generation
   *
   * @private
   * @param {Record<string, unknown>} schema - The schema to generate data for
   * @param {string} [description] - Optional description of the structured data
   * @returns {string} Formatted system prompt
   */
  private buildStructuredOutputSystemPrompt(
    schema: Record<string, unknown>,
    description?: string
  ): string {
    const schemaDescription = description || "structured data";

    return `You are a helpful assistant that generates ${schemaDescription} in a consistent JSON format.

SCHEMA REQUIREMENTS:
${JSON.stringify(schema, null, 2)}

INSTRUCTIONS:
1. Analyze the user's request carefully
2. Generate data that matches the schema exactly
3. Output ONLY valid JSON that conforms to the schema
4. Do not include any explanations, comments, or additional text
5. If the request cannot be fulfilled with the given schema, return an empty object {}

Your response must be parseable JSON that matches the provided schema.`;
  }

  /**
   * Build system prompt for reasoning tasks
   *
   * @private
   * @param {ReasoningRequest} request - The reasoning request configuration
   * @returns {string} Formatted system prompt
   */
  private buildReasoningSystemPrompt(request: ReasoningRequest): string {
    let prompt =
      "You are a reasoning assistant that helps analyze problems and provide thoughtful responses.\n\n";

    if (request.requireStructuredOutput && request.outputSchema) {
      prompt += `RESPONSE FORMAT: You must respond with structured data in JSON format.\n`;
      prompt += `OUTPUT SCHEMA:\n${JSON.stringify(
        request.outputSchema,
        null,
        2
      )}\n\n`;
      prompt +=
        "Your response must be valid JSON that conforms to the schema above.\n";
    } else {
      prompt +=
        "RESPONSE FORMAT: Provide your reasoning and conclusion in clear, natural language.\n";
    }

    prompt += "INSTRUCTIONS:\n";
    prompt += "1. Think step by step about the problem\n";
    prompt += "2. Consider all aspects and potential solutions\n";
    prompt += "3. Provide a well-reasoned response based on your analysis\n";

    return prompt;
  }

  /**
   * Parse and validate structured output from LLM response
   *
   * @private
   * @template T - The type of structured data expected
   * @param {string} content - The raw content from LLM response
   * @param {Record<string, unknown>} schema - The schema to validate against
   * @returns {T} Parsed and validated structured data
   * @throws {Error} When content doesn't match schema
   */
  private parseStructuredOutput<T>(
    content: string,
    schema: Record<string, unknown>
  ): T {
    const cleanedContent = this.cleanResponseContent(content);
    const parsed = JSON.parse(cleanedContent);

    const schemaKeys = Object.keys(schema);
    const parsedKeys = Object.keys(parsed);

    const missingKeys = schemaKeys.filter((key) => !parsedKeys.includes(key));
    if (missingKeys.length > 0) {
      throw new Error(`Missing required fields: ${missingKeys.join(", ")}`);
    }

    return parsed as T;
  }

  /**
   * Safely parse structured output with error handling
   *
   * @private
   * @template T - The type of structured data expected
   * @param {string} content - The raw content from LLM response
   * @param {Record<string, unknown>} schema - The schema to validate against
   * @returns {Object} Parse result with isValid flag, data, and optional errors
   */
  private safeParseStructuredOutput<T>(
    content: string,
    schema: Record<string, unknown>
  ): { isValid: boolean; data: T | null; errors?: string[] } {
    try {
      const data = this.parseStructuredOutput<T>(content, schema);
      return { isValid: true, data };
    } catch (error) {
      return {
        isValid: false,
        data: null,
        errors: [
          `Failed to parse structured output: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  }

  /**
   * Clean response content by removing markdown code blocks
   *
   * @private
   * @param {string} content - Raw content that may contain markdown formatting
   * @returns {string} Cleaned content ready for JSON parsing
   */
  private cleanResponseContent(content: string): string {
    return content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*$/gi, "")
      .replace(/```/g, "")
      .trim();
  }

  /**
   * Extract message content from API response
   *
   * @private
   * @param {ChatCompletionResponse} response - The API response object
   * @returns {string} Extracted message content or empty string
   */
  private extractMessageContent(response: ChatCompletionResponse): string {
    const content = response.choices[0]?.message?.content;
    return content?.trim() ?? "";
  }

  /**
   * Safely read error response body
   *
   * @private
   * @param {Response} response - The failed HTTP response
   * @returns {Promise<string>} Error details string or empty string
   */
  private async safeReadErrorResponse(response: Response): Promise<string> {
    try {
      const data = await response.json();
      return data ? ` | Details: ${JSON.stringify(data)}` : "";
    } catch {
      try {
        const text = await response.text();
        return text ? ` | Details: ${text}` : "";
      } catch {
        return "";
      }
    }
  }

  /**
   * Wrap errors in LLMServiceError
   *
   * @private
   * @param {unknown} error - The error to wrap
   * @param {string} operation - The operation that failed
   * @returns {LLMServiceError} Wrapped error instance
   */
  private wrapError(error: unknown, operation: string): LLMServiceError {
    if (error instanceof LLMServiceError) {
      return error;
    }
    return new LLMServiceError(
      error instanceof Error ? error.message : String(error),
      operation,
      undefined,
      error
    );
  }

  /**
   * Get service configuration (for debugging/inspection)
   *
   * @returns {Required<LLMConfig>} A copy of the current service configuration
   *
   * @example
   * ```typescript
   * const config = llmService.getConfig();
   * console.log(`Using model: ${config.model}`);
   * ```
   */
  getConfig(): Required<LLMConfig> {
    return { ...this.config };
  }
}

/**
 * Helper function to create an LLM service instance
 *
 * @param {LLMConfig} config - Configuration object with API key and optional settings
 * @returns {LLMService} New LLMService instance
 *
 * @example
 * ```typescript
 * const llmService = createLLMService({
 *   apiKey: 'your-api-key',
 *   model: 'gpt-4'
 * });
 * ```
 */
export function createLLMService(config: LLMConfig): LLMService {
  return new LLMService(config);
}

// Re-export types and interfaces for convenience
export type {
  LLMConfig,
  LLMResponse,
  StructuredLLMResponse,
  StructuredOutputRequest,
  ReasoningRequest,
  LLMUsage,
  ChatMessage,
};
export { LLMServiceError };
