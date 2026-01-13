/**
 * LLM Service Type Definitions
 *
 * Contains all type definitions, interfaces, and enums used by the LLM Service.
 * These types define the structure of requests, responses, and configuration.
 */

/**
 * Configuration for LLM Service initialization
 *
 * @interface LLMConfig
 * @property {string} apiKey - API key for authenticating with the LLM provider (required)
 * @property {string} [baseUrl] - Base URL for the LLM API endpoint (optional, defaults to OpenAI)
 * @property {string} [model] - Model identifier to use (optional, defaults to 'gpt-3.5-turbo')
 * @property {number} [temperature] - Temperature setting for response randomness 0-1 (optional, defaults to 0.7)
 * @property {number} [maxTokens] - Maximum tokens in responses (optional, defaults to 1000)
 */
export interface LLMConfig {
  /** API key for authenticating with the LLM provider */
  apiKey: string;
  /** Base URL for the LLM API endpoint */
  baseUrl?: string;
  /** Model identifier to use */
  model?: string;
  /** Temperature setting for response randomness (0-1) */
  temperature?: number;
  /** Maximum tokens in responses */
  maxTokens?: number;
}

/**
 * Request for structured output generation
 *
 * @interface StructuredOutputRequest
 * @property {string} prompt - The user's prompt/question
 * @property {Record<string, unknown>} schema - JSON schema defining the expected output structure
 * @property {string} [description] - Optional description of the structured data being generated
 * @property {number} [temperatureOverride] - Optional temperature override for this request
 * @property {number} [maxTokensOverride] - Optional max tokens override for this request
 * @property {string} [modelOverride] - Optional model override for this request (e.g., 'gpt-4o-mini')
 */
export interface StructuredOutputRequest {
  /** The user's prompt/question */
  prompt: string;
  /** JSON schema defining the expected output structure */
  schema: Record<string, unknown>;
  /** Optional description of the structured data being generated */
  description?: string;
  /** Optional temperature override for this request */
  temperatureOverride?: number;
  /** Optional max tokens override for this request */
  maxTokensOverride?: number;
  /** Optional model override for this request */
  modelOverride?: string;
}

/**
 * Request for reasoning tasks with optional structured output
 *
 * @interface ReasoningRequest
 * @property {string} prompt - The reasoning prompt/question
 * @property {string} [context] - Optional context information to provide to the LLM
 * @property {boolean} [requireStructuredOutput] - Whether to require structured output format
 * @property {Record<string, unknown>} [outputSchema] - Schema for structured output (required if requireStructuredOutput is true)
 * @property {number} [temperatureOverride] - Optional temperature override for this request
 * @property {number} [maxTokensOverride] - Optional max tokens override for this request
 */
export interface ReasoningRequest {
  /** The reasoning prompt/question */
  prompt: string;
  /** Optional context information to provide to the LLM */
  context?: string;
  /** Whether to require structured output format */
  requireStructuredOutput?: boolean;
  /** Schema for structured output (required if requireStructuredOutput is true) */
  outputSchema?: Record<string, unknown>;
  /** Optional temperature override for this request */
  temperatureOverride?: number;
  /** Optional max tokens override for this request */
  maxTokensOverride?: number;
}

/**
 * Token usage statistics from an LLM API call
 *
 * @interface LLMUsage
 * @property {number} promptTokens - Number of tokens in the prompt
 * @property {number} completionTokens - Number of tokens in the completion
 * @property {number} totalTokens - Total tokens used (prompt + completion)
 */
export interface LLMUsage {
  /** Number of tokens in the prompt */
  promptTokens: number;
  /** Number of tokens in the completion */
  completionTokens: number;
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
}

/**
 * Standard LLM response structure
 *
 * @interface LLMResponse
 * @property {string} content - The text content of the LLM response
 * @property {LLMUsage} [usage] - Optional token usage statistics
 */
export interface LLMResponse {
  /** The text content of the LLM response */
  content: string;
  /** Optional token usage statistics */
  usage?: LLMUsage;
}

/**
 * Structured LLM response with validation information
 *
 * @interface StructuredLLMResponse
 * @template T - The type of structured data (defaults to Record<string, unknown>)
 * @extends LLMResponse
 * @property {T | null} structuredData - Parsed structured data, or null if parsing failed
 * @property {boolean} isValid - Whether the structured data is valid according to the schema
 * @property {string[]} [validationErrors] - Array of validation error messages if isValid is false
 */
export interface StructuredLLMResponse<T = Record<string, unknown>>
  extends LLMResponse {
  /** Parsed structured data, or null if parsing failed */
  structuredData: T | null;
  /** Whether the structured data is valid according to the schema */
  isValid: boolean;
  /** Array of validation error messages if isValid is false */
  validationErrors?: string[];
}

/**
 * Chat message structure for LLM conversations
 *
 * @interface ChatMessage
 * @property {('system' | 'user' | 'assistant')} role - The role of the message sender
 * @property {string} content - The message content
 */
export interface ChatMessage {
  /** The role of the message sender */
  role: "system" | "user" | "assistant";
  /** The message content */
  content: string;
}

/**
 * Internal chat completion response structure from LLM API
 *
 * @interface ChatCompletionResponse
 * @internal
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  usage?: LLMUsage;
  choices: Array<{
    index: number;
    finish_reason?: string;
    message?: {
      role: "system" | "user" | "assistant";
      content?: string;
    };
  }>;
}

/**
 * Custom error class for LLM Service operations
 *
 * @class LLMServiceError
 * @extends Error
 * @property {string} [operation] - The operation that failed
 * @property {number} [statusCode] - HTTP status code if applicable
 * @property {unknown} [cause] - The underlying error that caused this error
 */
export class LLMServiceError extends Error {
  /**
   * Creates an instance of LLMServiceError
   *
   * @param {string} message - Error message
   * @param {string} [operation] - The operation that failed
   * @param {number} [statusCode] - HTTP status code if applicable
   * @param {unknown} [cause] - The underlying error that caused this error
   */
  constructor(
    message: string,
    public readonly operation?: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "LLMServiceError";
  }
}
