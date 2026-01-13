/**
 * Agent Orchestrator Interface
 *
 * Defines the contract for Agent Orchestrator implementations.
 * This interface provides abstraction for different orchestrator implementations
 * and enables dependency injection and testing.
 */

import {
  OrchestratorResult,
  OrchestratorState,
} from "../types/orchestrator.types";

/**
 * Interface for Agent Orchestrator implementations
 *
 * @interface IOrchestrator
 * @description Provides methods for orchestrating autonomous agent execution
 * with LLM-based planning, step-by-step tool execution, and internal memory.
 */
export interface IOrchestrator {
  /**
   * Execute a user query by planning and executing tool calls step by step
   *
   * @param {string} userQuery - The user's query or task request
   * @returns {Promise<OrchestratorResult>} Promise resolving to the execution result
   * @throws {OrchestratorError} When execution fails
   *
   * @example
   * ```typescript
   * const result = await orchestrator.execute("Calculate the weather for New York and send me an email");
   * if (result.success) {
   *   console.log(result.finalResponse);
   * }
   * ```
   */
  execute(userQuery: string, systemPrompt?: string): Promise<OrchestratorResult>;

  /**
   * Get the current state of the orchestrator
   *
   * @returns {OrchestratorState} Current orchestrator state
   *
   * @example
   * ```typescript
   * const state = orchestrator.getState();
   * console.log(`Status: ${state.status}, Steps completed: ${state.currentStepIndex}`);
   * ```
   */
  getState(): OrchestratorState;

  /**
   * Reset the orchestrator state (clears memory and history)
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * orchestrator.reset();
   * ```
   */
  reset(): void;

  /**
   * Continue execution from the current state
   * Useful for resuming after an error or pause
   *
   * @returns {Promise<OrchestratorResult>} Promise resolving to the execution result
   * @throws {OrchestratorError} When execution fails
   *
   * @example
   * ```typescript
   * try {
   *   await orchestrator.execute("Complex task");
   * } catch (error) {
   *   // Fix issue and continue
   *   await orchestrator.continue();
   * }
   * ```
   */
  continue(): Promise<OrchestratorResult>;
}
