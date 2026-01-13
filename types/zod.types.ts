/**
 * Zod Schema Type Definitions
 *
 * Provides type-safe tool definitions using Zod schemas.
 * Enables automatic TypeScript type inference for tool arguments.
 */

import { z } from "zod";

/**
 * Configuration for creating a typed tool with Zod schema
 *
 * @template TSchema - Zod schema type
 * @template TResult - Return type of the execute function
 */
export interface ZodToolConfig<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TResult = unknown
> {
    /** Unique identifier for the tool */
    name: string;
    /** Human-readable description of what the tool does */
    description: string;
    /** Zod schema defining expected arguments */
    schema: TSchema;
    /** Function to execute the tool with typed arguments */
    execute: (args: z.infer<TSchema>) => Promise<TResult>;
    /** Whether this tool uses LLM to generate parameters from user input */
    agentic?: boolean;
    /** System prompt for agentic tools */
    systemPrompt?: string;
    /** Whether to validate parameters before execution (default: true) */
    validate?: boolean;
}

/**
 * Type-safe tool interface with Zod schema
 *
 * @template TSchema - Zod schema type
 * @template TResult - Return type of the execute function
 */
export interface TypedTool<
    TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
    TResult = unknown
> {
    /** Unique identifier for the tool */
    name: string;
    /** Human-readable description of what the tool does */
    description: string;
    /** Zod schema defining expected arguments */
    zodSchema: TSchema;
    /** Function to execute the tool with typed arguments */
    execute: (args: z.infer<TSchema>) => Promise<TResult>;
    /** Whether this tool uses LLM to generate parameters from user input */
    agentic?: boolean;
    /** System prompt for agentic tools */
    systemPrompt?: string;
    /** Whether to validate parameters before execution (default: true) */
    validate?: boolean;
}

/**
 * Utility type to extract argument types from a TypedTool
 *
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string() });
 * const tool = defineToolWithZod({ ... });
 * type Args = InferToolArgs<typeof tool>; // { name: string }
 * ```
 */
export type InferToolArgs<T> = T extends TypedTool<infer TSchema, unknown>
    ? z.infer<TSchema>
    : never;

/**
 * Utility type to extract result type from a TypedTool
 */
export type InferToolResult<T> = T extends TypedTool<z.ZodObject<z.ZodRawShape>, infer TResult>
    ? TResult
    : never;
