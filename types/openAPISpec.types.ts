/**
 * OpenAPI Schema Property definition
 * Matches OpenAPI 3.0 specification for schema properties
 */
export interface OpenAPISchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  items?: OpenAPISchemaProperty | OpenAPISchema;
  properties?: Record<string, OpenAPISchemaProperty>;
  required?: string[];
  enum?: (string | number)[];
  default?: unknown;
  format?: string; // e.g., "email", "uri", "date-time"
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/**
 * OpenAPI Schema definition (full schema object)
 * Matches OpenAPI 3.0 specification for request/response schemas
 */
export interface OpenAPISchema {
  type: "object";
  properties: Record<string, OpenAPISchemaProperty>;
  required?: string[];
  description?: string;
}

/**
 * Parameters Schema - accepts either OpenAPI schema format or simplified format
 * Simplified format is converted to OpenAPI format internally
 */
export type ParametersSchema =
  | OpenAPISchema
  | Record<string, OpenAPISchemaProperty>;
