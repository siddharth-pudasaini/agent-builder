/**
 * Agent Orchestrator Type Definitions
 *
 * Contains all type definitions, interfaces, and enums used by the Agent Orchestrator.
 * These types define the structure of orchestrator state, configuration, and execution results.
 */

import { IAgent } from "../interfaces/agent.interface";
import { ToolCall } from "./agent.types";

/**
 * Status of the orchestrator execution
 */
export type OrchestratorStatus =
  | "idle"
  | "planning"
  | "executing"
  | "completed"
  | "error";

/**
 * A single step in the execution plan
 *
 * @interface ExecutionStep
 * @property {number} stepNumber - Sequential step number
 * @property {string} description - Human-readable description of what this step does
 * @property {ToolCall} toolCall - The tool call to execute
 * @property {boolean} completed - Whether this step has been completed
 * @property {unknown} [result] - Result from tool execution (if completed)
 * @property {string} [error] - Error message if step failed
 * @property {number[]} [dependsOn] - Step numbers this step depends on
 */
export interface ExecutionStep {
  /** Sequential step number */
  stepNumber: number;
  /** Human-readable description of what this step does */
  description: string;
  /** The tool call to execute */
  toolCall: ToolCall;
  /** Whether this step has been completed */
  completed: boolean;
  /** Result from tool execution (if completed) */
  result?: unknown;
  /** Error message if step failed */
  error?: string;
  /** Step numbers this step depends on */
  dependsOn?: number[];
}

/**
 * Internal state maintained by the orchestrator during execution
 *
 * @interface OrchestratorState
 * @property {string} userQuery - Original user query
 * @property {string} [plan] - Generated action plan from LLM
 * @property {ExecutionStep[]} steps - List of execution steps
 * @property {number} currentStepIndex - Index of the current step being executed
 * @property {OrchestratorStatus} status - Current status of the orchestrator
 * @property {string[]} conversationHistory - Conversation history with LLM
 * @property {Record<string, unknown>} context - Additional context data accumulated during execution
 * @property {string} [error] - Error message if execution failed
 */
export interface OrchestratorState {
  /** Original user query */
  userQuery: string;
  /** Generated action plan from LLM */
  plan?: string;
  /** List of execution steps */
  steps: ExecutionStep[];
  /** Index of the current step being executed */
  currentStepIndex: number;
  /** Current status of the orchestrator */
  status: OrchestratorStatus;
  /** Conversation history with LLM */
  conversationHistory: string[];
  /** Additional context data accumulated during execution */
  context: Record<string, unknown>;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Configuration for the Agent Orchestrator
 *
 * @interface OrchestratorConfig
 * @property {IAgent} agent - The agent instance to orchestrate (required)
 * @property {number} [maxSteps] - Maximum number of steps to execute (default: 10)
 * @property {number} [maxIterations] - Maximum number of planning iterations (default: 5)
 * @property {boolean} [verbose] - Enable verbose logging (default: false)
 * @property {number} [planningTemperature] - Temperature for planning LLM calls (default: 0.7)
 */
export interface OrchestratorConfig {
  /** The agent instance to orchestrate */
  agent: IAgent;
  /** Maximum number of steps to execute */
  maxSteps?: number;
  /** Maximum number of planning iterations */
  maxIterations?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Temperature for planning LLM calls */
  planningTemperature?: number;
}

/**
 * Result of orchestrator execution
 *
 * @interface OrchestratorResult
 * @property {boolean} success - Whether the execution completed successfully
 * @property {string} finalResponse - Final response message to the user
 * @property {ExecutionStep[]} steps - All execution steps that were performed
 * @property {OrchestratorState} state - Final state of the orchestrator
 * @property {string} [error] - Error message if execution failed
 */
export interface OrchestratorResult {
  /** Whether the execution completed successfully */
  success: boolean;
  /** Final response message to the user */
  finalResponse: string;
  /** All execution steps that were performed */
  steps: ExecutionStep[];
  /** Final state of the orchestrator */
  state: OrchestratorState;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Custom error class for Orchestrator operations
 *
 * @class OrchestratorError
 * @extends Error
 * @property {string} [stepNumber] - Step number where error occurred
 */
export class OrchestratorError extends Error {
  /**
   * Creates an instance of OrchestratorError
   *
   * @param {string} message - Error message
   * @param {number} [stepNumber] - Step number where error occurred
   */
  constructor(message: string, public readonly stepNumber?: number) {
    super(message);
    this.name = "OrchestratorError";
  }
}
