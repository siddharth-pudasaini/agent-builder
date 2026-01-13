/**
 * Zod Schema Helpers
 *
 * Utilities for working with Zod schemas in the context of tool definitions.
 * Provides conversion between Zod schemas and OpenAPI schemas for LLM compatibility.
 * Compatible with Zod v4.
 */

import { z } from "zod";
import {
    OpenAPISchema,
    OpenAPISchemaProperty,
} from "../types/openAPISpec.types";
import { Tool } from "../types/agent.types";
import { TypedTool, ZodToolConfig } from "../types/zod.types";

/**
 * Get the type name from a Zod schema for OpenAPI conversion
 */
function getZodTypeName(schema: z.ZodType): string {
    // Use the schema's _zod property to determine type
    const def = (schema as unknown as { _zod: { def: { type: string } } })._zod?.def;
    if (def?.type) {
        return def.type;
    }

    // Fallback: check constructor name
    const constructorName = schema.constructor.name;
    if (constructorName.startsWith("Zod")) {
        return constructorName.slice(3).toLowerCase();
    }

    return "unknown";
}

/**
 * Check if a Zod type is optional
 */
function isZodOptional(schema: z.ZodType): boolean {
    const typeName = getZodTypeName(schema);
    return typeName === "optional" || typeName === "nullable";
}

/**
 * Unwrap optional/nullable Zod types
 */
function unwrapZodType(schema: z.ZodType): z.ZodType {
    const typeName = getZodTypeName(schema);
    if (typeName === "optional" || typeName === "nullable") {
        const innerType = (schema as unknown as { unwrap?: () => z.ZodType }).unwrap?.();
        if (innerType) return innerType;
    }
    return schema;
}

/**
 * Get description from a Zod type
 */
function getZodDescription(schema: z.ZodType): string | undefined {
    return (schema as unknown as { description?: string }).description;
}

/**
 * Convert a Zod schema to OpenAPI property
 */
function zodTypeToOpenAPIProperty(
    zodType: z.ZodType,
    description?: string
): OpenAPISchemaProperty {
    const unwrapped = unwrapZodType(zodType);
    const typeName = getZodTypeName(unwrapped);
    const desc = description || getZodDescription(zodType);

    switch (typeName) {
        case "string": {
            const prop: OpenAPISchemaProperty = { type: "string" };
            if (desc) prop.description = desc;
            return prop;
        }

        case "number": {
            const prop: OpenAPISchemaProperty = { type: "number" };
            if (desc) prop.description = desc;
            return prop;
        }

        case "int":
        case "integer": {
            const prop: OpenAPISchemaProperty = { type: "integer" };
            if (desc) prop.description = desc;
            return prop;
        }

        case "boolean": {
            const prop: OpenAPISchemaProperty = { type: "boolean" };
            if (desc) prop.description = desc;
            return prop;
        }

        case "enum": {
            // Extract enum values
            const enumDef = (unwrapped as unknown as { _zod: { def: { entries: unknown[] } } })._zod?.def;
            const entries = enumDef?.entries || [];
            const values = entries.map((e: unknown) => {
                if (typeof e === "string") return e;
                if (Array.isArray(e) && e.length > 0) return e[0];
                return String(e);
            });

            const prop: OpenAPISchemaProperty = {
                type: "string",
                enum: values as string[],
            };
            if (desc) prop.description = desc;
            return prop;
        }

        case "literal": {
            const literalDef = (unwrapped as unknown as { _zod: { def: { values: unknown[] } } })._zod?.def;
            const values = literalDef?.values || [];
            const value = values[0];
            const prop: OpenAPISchemaProperty = {
                type: typeof value === "number" ? "number" : "string",
                enum: values as (string | number)[],
            };
            if (desc) prop.description = desc;
            return prop;
        }

        case "array": {
            const arrayDef = (unwrapped as unknown as { _zod: { def: { element: z.ZodType } } })._zod?.def;
            const itemType = arrayDef?.element;
            const prop: OpenAPISchemaProperty = {
                type: "array",
                items: itemType ? zodTypeToOpenAPIProperty(itemType) : { type: "string" },
            };
            if (desc) prop.description = desc;
            return prop;
        }

        case "object": {
            const objectDef = (unwrapped as unknown as {
                _zod: { def: { shape: Record<string, z.ZodType> } }
            })._zod?.def;
            const shape = objectDef?.shape || {};

            const properties: Record<string, OpenAPISchemaProperty> = {};
            const required: string[] = [];

            for (const [key, value] of Object.entries(shape)) {
                const propDesc = getZodDescription(value);
                properties[key] = zodTypeToOpenAPIProperty(value, propDesc);
                if (!isZodOptional(value)) {
                    required.push(key);
                }
            }

            const prop: OpenAPISchemaProperty = {
                type: "object",
                properties,
            };
            if (required.length > 0) prop.required = required;
            if (desc) prop.description = desc;
            return prop;
        }

        default: {
            // Fallback to string
            const prop: OpenAPISchemaProperty = { type: "string" };
            if (desc) prop.description = desc;
            return prop;
        }
    }
}

/**
 * Convert a Zod object schema to OpenAPI schema format
 *
 * @param schema - Zod object schema to convert
 * @returns OpenAPI-compatible schema
 *
 * @example
 * ```typescript
 * const mySchema = z.object({
 *   name: z.string().describe('The user name'),
 *   age: z.number().min(0).max(120),
 * });
 * const openAPISchema = zodToOpenAPI(mySchema);
 * ```
 */
export function zodToOpenAPI(
    schema: z.ZodObject<z.ZodRawShape>
): OpenAPISchema {
    const objectDef = (schema as unknown as {
        _zod: { def: { shape: Record<string, z.ZodType> } }
    })._zod?.def;
    const shape = objectDef?.shape || {};

    const properties: Record<string, OpenAPISchemaProperty> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
        const description = getZodDescription(value);
        properties[key] = zodTypeToOpenAPIProperty(value, description);

        if (!isZodOptional(value)) {
            required.push(key);
        }
    }

    const result: OpenAPISchema = {
        type: "object",
        properties,
    };

    if (required.length > 0) {
        result.required = required;
    }

    const schemaDesc = getZodDescription(schema);
    if (schemaDesc) {
        result.description = schemaDesc;
    }

    return result;
}

/**
 * Create a type-safe tool with Zod schema
 *
 * This function provides full TypeScript type inference for tool arguments.
 * The `execute` function will receive properly typed arguments based on the Zod schema.
 *
 * @template TSchema - Zod schema type (inferred)
 * @template TResult - Return type of execute function (inferred)
 * @param config - Tool configuration with Zod schema
 * @returns A TypedTool with full type information
 *
 * @example
 * ```typescript
 * const calculatorTool = defineToolWithZod({
 *   name: 'calculator',
 *   description: 'Performs arithmetic operations',
 *   schema: z.object({
 *     operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
 *     a: z.number().describe('First operand'),
 *     b: z.number().describe('Second operand'),
 *   }),
 *   execute: async (args) => {
 *     // args is fully typed: { operation: 'add' | ...; a: number; b: number }
 *     switch (args.operation) {
 *       case 'add': return args.a + args.b;
 *       case 'subtract': return args.a - args.b;
 *       case 'multiply': return args.a * args.b;
 *       case 'divide': return args.a / args.b;
 *     }
 *   }
 * });
 * ```
 */
export function defineToolWithZod<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TResult = unknown
>(config: ZodToolConfig<TSchema, TResult>): TypedTool<TSchema, TResult> {
    return {
        name: config.name,
        description: config.description,
        zodSchema: config.schema,
        execute: config.execute,
        agentic: config.agentic ?? false,
        systemPrompt: config.systemPrompt,
        validate: config.validate ?? true,
    };
}

/**
 * Convert a TypedTool (with Zod schema) to a regular Tool (with OpenAPI schema)
 *
 * This allows TypedTools to be used with the existing Agent implementation.
 *
 * @param typedTool - A TypedTool with Zod schema
 * @returns A regular Tool compatible with Agent
 *
 * @example
 * ```typescript
 * const typedTool = defineToolWithZod({ ... });
 * const tool = typedToolToTool(typedTool);
 * const agent = new Agent({ tools: [tool], llmService });
 * ```
 */
export function typedToolToTool<
    TSchema extends z.ZodObject<z.ZodRawShape>,
    TResult = unknown
>(typedTool: TypedTool<TSchema, TResult>): Tool {
    return {
        name: typedTool.name,
        description: typedTool.description,
        parametersSchema: zodToOpenAPI(typedTool.zodSchema),
        execute: typedTool.execute as (
            args: Record<string, unknown>
        ) => Promise<unknown>,
        agentic: typedTool.agentic,
        systemPrompt: typedTool.systemPrompt,
        validate: typedTool.validate,
    };
}

/**
 * Validate data against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with parsed data or errors
 */
export function validateWithZod<TSchema extends z.ZodObject<z.ZodRawShape>>(
    schema: TSchema,
    data: unknown
): {
    isValid: boolean;
    data?: z.infer<TSchema>;
    errors?: string[];
} {
    const result = schema.safeParse(data);

    if (result.success) {
        return {
            isValid: true,
            data: result.data,
        };
    }

    // Zod v4 uses issues property
    const issues = (result.error as unknown as { issues?: Array<{ path: (string | number)[]; message: string }> }).issues || [];
    const errors = issues.map(
        (e: { path: (string | number)[]; message: string }) =>
            `${e.path.join(".")}: ${e.message}`
    );

    return {
        isValid: false,
        errors: errors.length > 0 ? errors : ["Validation failed"],
    };
}
