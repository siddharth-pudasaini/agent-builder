import {
  ParametersSchema,
  OpenAPISchema,
  OpenAPISchemaProperty,
} from "../types/openAPISpec.types";
/**
 * Validation result interface
 */

interface ValidationResult {
  isValid: boolean;
  data?: Record<string, unknown>;
  errors?: string[];
}

/**
 * Normalize schema to OpenAPI format
 *
 * @private
 * @param {ParametersSchema} schema - The schema to normalize
 * @returns {OpenAPISchema} Normalized OpenAPI schema
 */
export function normalizeToOpenAPISchema(schema: ParametersSchema): OpenAPISchema {
  // If already in OpenAPI format (has type: "object" and properties)
  if (
    typeof schema === "object" &&
    "type" in schema &&
    schema.type === "object" &&
    "properties" in schema
  ) {
    return schema as OpenAPISchema;
  }

  // Convert simplified format to OpenAPI format
  const properties: Record<string, OpenAPISchemaProperty> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === "object" && value !== null && "type" in value) {
      // Already an OpenAPISchemaProperty
      properties[key] = value as OpenAPISchemaProperty;
      // All properties in simplified format are required by default
      required.push(key);
    } else {
      // Simple format - convert to OpenAPISchemaProperty
      const propType =
        typeof value === "string"
          ? (value as "string" | "number" | "boolean" | "array" | "object")
          : "string";
      properties[key] = {
        type: propType === "number" ? "number" : propType,
      };
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}

/**
 * Validate data against an OpenAPI schema property
 *
 * @private
 * @param {unknown} value - The value to validate
 * @param {OpenAPISchemaProperty} property - The property schema
 * @param {string} fieldPath - The field path for error messages
 * @returns {Object} Validation result
 */
export function validateProperty(
  value: unknown,
  property: OpenAPISchemaProperty,
  fieldPath: string
): { isValid: boolean; validatedValue?: unknown; error?: string } {
  // Handle null/undefined
  if (value === undefined || value === null) {
    return { isValid: false, error: `Missing required field: ${fieldPath}` };
  }

  // Validate type
  const expectedType = property.type;
  const actualType = Array.isArray(value)
    ? "array"
    : value === null
    ? "null"
    : typeof value;

  if (expectedType === "integer" && typeof value !== "number") {
    return {
      isValid: false,
      error: `Field '${fieldPath}' must be an integer, got ${actualType}`,
    };
  }

  if (expectedType === "number" && typeof value !== "number") {
    return {
      isValid: false,
      error: `Field '${fieldPath}' must be a number, got ${actualType}`,
    };
  }

  if (expectedType === "string" && typeof value !== "string") {
    return {
      isValid: false,
      error: `Field '${fieldPath}' must be a string, got ${actualType}`,
    };
  }

  if (expectedType === "boolean" && typeof value !== "boolean") {
    return {
      isValid: false,
      error: `Field '${fieldPath}' must be a boolean, got ${actualType}`,
    };
  }

  if (expectedType === "array" && !Array.isArray(value)) {
    return {
      isValid: false,
      error: `Field '${fieldPath}' must be an array, got ${actualType}`,
    };
  }

  if (
    expectedType === "object" &&
    (typeof value !== "object" || Array.isArray(value) || value === null)
  ) {
    return {
      isValid: false,
      error: `Field '${fieldPath}' must be an object, got ${actualType}`,
    };
  }

  // Validate enum if specified
  if (property.enum && !property.enum.includes(value as string | number)) {
    return {
      isValid: false,
      error: `Field '${fieldPath}' must be one of: ${property.enum.join(", ")}`,
    };
  }

  // Validate string constraints
  if (expectedType === "string" && typeof value === "string") {
    if (property.minLength !== undefined && value.length < property.minLength) {
      return {
        isValid: false,
        error: `Field '${fieldPath}' must be at least ${property.minLength} characters`,
      };
    }
    if (property.maxLength !== undefined && value.length > property.maxLength) {
      return {
        isValid: false,
        error: `Field '${fieldPath}' must be at most ${property.maxLength} characters`,
      };
    }
  }

  // Validate number constraints
  if (
    (expectedType === "number" || expectedType === "integer") &&
    typeof value === "number"
  ) {
    if (property.minimum !== undefined && value < property.minimum) {
      return {
        isValid: false,
        error: `Field '${fieldPath}' must be at least ${property.minimum}`,
      };
    }
    if (property.maximum !== undefined && value > property.maximum) {
      return {
        isValid: false,
        error: `Field '${fieldPath}' must be at most ${property.maximum}`,
      };
    }
  }

  // Validate nested objects
  if (expectedType === "object" && property.properties) {
    const nestedResult = validateAgainstOpenAPISchema(
      value as Record<string, unknown>,
      {
        type: "object",
        properties: property.properties,
        required: property.required,
      }
    );
    if (!nestedResult.isValid) {
      return {
        isValid: false,
        error: `Field '${fieldPath}' validation failed: ${nestedResult.errors?.join(
          ", "
        )}`,
      };
    }
    return { isValid: true, validatedValue: nestedResult.data };
  }

  // Validate array items
  if (expectedType === "array" && Array.isArray(value) && property.items) {
    const itemErrors: string[] = [];
    const validatedItems: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const itemResult = validateProperty(
        value[i],
        property.items,
        `${fieldPath}[${i}]`
      );
      if (!itemResult.isValid) {
        itemErrors.push(itemResult.error || "Invalid item");
      } else {
        validatedItems.push(itemResult.validatedValue ?? value[i]);
      }
    }
    if (itemErrors.length > 0) {
      return { isValid: false, error: itemErrors.join("; ") };
    }
    return { isValid: true, validatedValue: validatedItems };
  }

  return { isValid: true, validatedValue: value };
}

/**
 * Validate data against an OpenAPI schema
 *
 * @private
 * @param {Record<string, unknown>} data - The data to validate
 * @param {OpenAPISchema} schema - The OpenAPI schema to validate against
 * @returns {ValidationResult} Validation result with isValid flag and optional errors
 */
export function validateAgainstOpenAPISchema(
  data: Record<string, unknown>,
  schema: OpenAPISchema
): ValidationResult {
  const errors: string[] = [];
  const validatedData: Record<string, unknown> = {};
  const requiredFields = schema.required || [];

  // Validate required fields
  for (const fieldName of requiredFields) {
    if (
      !(fieldName in data) ||
      data[fieldName] === undefined ||
      data[fieldName] === null
    ) {
      errors.push(`Missing required field: ${fieldName}`);
    }
  }

  // Validate all properties
  for (const [fieldName, property] of Object.entries(schema.properties)) {
    const value = data[fieldName];

    // Skip if field is not required and not provided
    if (
      !requiredFields.includes(fieldName) &&
      (value === undefined || value === null)
    ) {
      continue;
    }

    const result = validateProperty(value, property, fieldName);
    if (!result.isValid) {
      errors.push(result.error || `Invalid field: ${fieldName}`);
    } else {
      validatedData[fieldName] = result.validatedValue ?? value;
    }
  }

  // Check for extra fields (strict validation)
  for (const key of Object.keys(data)) {
    if (!(key in schema.properties)) {
      errors.push(`Unexpected field: ${key}`);
    }
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? validatedData : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate data against a schema (supports both formats)
 *
 * @private
 * @param {Record<string, unknown>} data - The data to validate
 * @param {ParametersSchema} schema - The schema to validate against
 * @returns {ValidationResult} Validation result with isValid flag and optional errors
 */
export function validateAgainstSchema(
  data: Record<string, unknown>,
  schema: ParametersSchema
): ValidationResult {
  const openAPISchema = normalizeToOpenAPISchema(schema);
  return validateAgainstOpenAPISchema(data, openAPISchema);
}
