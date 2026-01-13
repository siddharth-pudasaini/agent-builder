/**
 * LLM Service Interface
 *
 * Defines the contract for LLM service implementations.
 * This interface provides abstraction for different LLM providers
 * and enables dependency injection and testing.
 */

import type {
  LLMConfig,
  LLMResponse,
  StructuredLLMResponse,
  StructuredOutputRequest,
  ReasoningRequest,
} from "../types/llmService.types";

/**
 * Interface for LLM Service implementations
 *
 * @interface ILLMService
 * @description Provides methods for interacting with Language Learning Models (LLMs)
 * including general responses, structured output generation, and reasoning capabilities.
 */
export interface ILLMService {
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
   * const response = await llmService.getResponse("What is TypeScript?");
   * console.log(response.content);
   * ```
   */
  getResponse(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<LLMResponse>;

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
   *   prompt: "Extract user information",
   *   schema: { name: "string", age: "number" },
   *   description: "User profile"
   * });
   * if (response.isValid) {
   *   console.log(response.structuredData);
   * }
   * ```
   */
  getStructuredOutput<T = Record<string, unknown>>(
    request: StructuredOutputRequest
  ): Promise<StructuredLLMResponse<T>>;

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
   *   prompt: "Analyze this problem",
   *   context: "Additional context here",
   *   requireStructuredOutput: true,
   *   outputSchema: { conclusion: "string", reasoning: "string" }
   * });
   * ```
   */
  getReasoningResponse(
    request: ReasoningRequest
  ): Promise<LLMResponse | StructuredLLMResponse>;

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
   * ```
   */
  validateStructuredOutput<T = Record<string, unknown>>(
    content: string,
    schema: Record<string, unknown>
  ): { isValid: boolean; data?: T; errors?: string[] };

  /**
   * Get service configuration (for debugging/inspection)
   *
   * @returns {Required<LLMConfig>} A copy of the current service configuration
   */
  getConfig(): Required<LLMConfig>;
}
