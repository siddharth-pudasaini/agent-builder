/**
 * Agent Orchestrator Implementation
 *
 * Concrete implementation of the IOrchestrator interface.
 * An autonomous agent runner that uses LLM to plan and execute tool calls step by step.
 *
 * @class Orchestrator
 * @implements {IOrchestrator}
 */

import { IAgent } from "../interfaces/agent.interface";
import { IOrchestrator } from "../interfaces/orchestrator.interface";
import {
  OrchestratorConfig,
  OrchestratorState,
  OrchestratorResult,
  OrchestratorStatus,
  ExecutionStep,
  OrchestratorError,
} from "../types/orchestrator.types";
import { ToolCall } from "../types/agent.types";

/**
 * Schema for planning response from LLM
 */
interface PlanningResponse {
  plan: string;
  steps: Array<{
    stepNumber: number;
    description: string;
    tool: string;
    arguments?: Record<string, unknown>;
    dependsOn?: number[]; // Step numbers this step depends on
  }>;
  isComplete: boolean;
}

/**
 * Schema for next step decision from LLM
 */
interface NextStepResponse {
  shouldContinue: boolean;
  nextStep?: {
    stepNumber: number;
    description: string;
    tool: string;
    arguments?: Record<string, unknown>;
  };
  finalResponse?: string;
  reasoning?: string;
}

/**
 * Orchestrator class for autonomous agent execution
 *
 * Provides methods for planning and executing tool calls step by step
 * using LLM-based decision making and internal memory.
 *
 * @class Orchestrator
 * @implements {IOrchestrator}
 */
export class Orchestrator implements IOrchestrator {
  /** The agent instance being orchestrated */
  private readonly agent: IAgent;

  /** Maximum number of steps to execute */
  private readonly maxSteps: number;

  /** Maximum number of planning iterations */
  private readonly maxIterations: number;

  /** Whether verbose logging is enabled */
  private readonly verbose: boolean;

  /** Temperature for planning LLM calls */
  private readonly planningTemperature: number;

  /** Current orchestrator state */
  private state: OrchestratorState;

  /**
   * Creates an instance of Orchestrator
   *
   * @param {OrchestratorConfig} config - Configuration object with agent and settings
   * @throws {OrchestratorError} When agent is not provided
   *
   * @example
   * ```typescript
   * const orchestrator = new Orchestrator({
   *   agent: agentInstance,
   *   maxSteps: 10,
   *   verbose: true
   * });
   * ```
   */
  constructor(config: OrchestratorConfig) {
    if (!config.agent) {
      throw new OrchestratorError("Orchestrator requires an agent instance");
    }

    this.agent = config.agent;
    this.maxSteps = Math.max(1, config.maxSteps ?? 10);
    this.maxIterations = Math.max(1, config.maxIterations ?? 5);
    this.verbose = config.verbose ?? false;
    this.planningTemperature = config.planningTemperature ?? 0.7;

    this.state = this.createInitialState("");
  }

  /**
   * Create initial orchestrator state
   *
   * @private
   * @param {string} userQuery - The user query
   * @returns {OrchestratorState} Initial state
   */
  private createInitialState(userQuery: string): OrchestratorState {
    return {
      userQuery,
      steps: [],
      currentStepIndex: 0,
      status: "idle",
      conversationHistory: [],
      context: {},
    };
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
    console.log(
      `[${timestamp}] [${level.toUpperCase()}] [Orchestrator] ${message}`
    );
  }

  /**
   * Get available tools description for LLM prompts
   *
   * @private
   * @returns {string} Formatted description of available tools
   */
  private getToolsDescription(): string {
    const tools = this.agent.getTools();
    if (tools.length === 0) {
      return "No tools available.";
    }

    return tools
      .map((tool) => {
        // Convert OpenAPI schema to simple description for planning
        try {
          const schema = tool.parametersSchema;
          if (schema && typeof schema === "object") {
            let properties: Record<
              string,
              { type: string; description?: string }
            > = {};
            let required: string[] = [];

            // Handle OpenAPI format (with type: "object" and properties)
            if (
              "type" in schema &&
              schema.type === "object" &&
              "properties" in schema
            ) {
              properties = schema.properties as Record<
                string,
                { type: string; description?: string }
              >;
              required = (schema.required || []) as string[];
            } else {
              // Handle simplified format (Record<string, OpenAPISchemaProperty>)
              properties = schema as Record<
                string,
                { type: string; description?: string }
              >;
            }

            const paramDesc = Object.entries(properties)
              .map(([key, prop]) => {
                const type =
                  typeof prop === "object" && "type" in prop
                    ? prop.type
                    : "unknown";
                const isRequired = required.includes(key);
                return `${key}: ${type}${isRequired ? "" : " (optional)"}`;
              })
              .join(", ");
            return `- ${tool.name}: ${tool.description} (Parameters: {${paramDesc}})`;
          }
        } catch {
          // Fallback if schema parsing fails
        }
        return `- ${tool.name}: ${tool.description}`;
      })
      .join("\n");
  }

  /**
   * Generate initial action plan using LLM
   *
   * @private
   * @param {string} userQuery - The user query
   * @param {PlanningResponse} [previousPlan] - Previous plan if regenerating
   * @param {ExecutionStep[]} [completedSteps] - Steps that have been completed
   * @returns {Promise<PlanningResponse>} Generated plan with steps
   * @throws {OrchestratorError} When planning fails
   */
  private async generatePlan(
    userQuery: string,
    systemPrompt?: string,
    previousPlan?: PlanningResponse,
    completedSteps?: ExecutionStep[]
  ): Promise<PlanningResponse> {
    const hasSystemPrompt = !!systemPrompt;
    const isRegeneration = !!previousPlan;
    this.log(
      isRegeneration
        ? "Regenerating action plan after failure..."
        : "Generating action plan..."
    );
    this.state.status = "planning";

    const toolsDescription = this.getToolsDescription();

    let prompt = `You are an autonomous agent orchestrator. Your task is to break down the user's query into a step-by-step action plan using the available tools.

User Query: "${userQuery}"

Available Tools:
${toolsDescription}`;

    // Add context if regenerating plan
    if (isRegeneration && previousPlan && completedSteps) {
      const completedStepsInfo = completedSteps
        .map(
          (s) =>
            `Step ${s.stepNumber}: ${s.description} - Result: ${JSON.stringify(
              s.result
            )}`
        )
        .join("\n");

      prompt += `

PREVIOUS PLAN (that encountered an error):
Plan: ${previousPlan.plan}

COMPLETED STEPS (successfully executed):
${completedStepsInfo || "No steps completed"}

The previous plan failed at some point. Generate a new plan that:
1. Incorporates the results from completed steps
2. Continues from where the previous plan left off
3. Avoids the error that occurred
4. Completes the remaining work needed to satisfy the user query`;
    } else {
      prompt += `

Generate a detailed action plan. Break down the task into logical steps. Each step should use one of the available tools.
If the task can be completed in a single step, return isComplete: true.
If multiple steps are needed, return isComplete: false and provide all steps.`;
    }

    prompt += `

IMPORTANT PLANNING RULES:

1. DEPENDENCIES: When steps depend on results from previous steps, you MUST specify dependencies:
   - If Step 2 needs data from Step 1, set dependsOn: [1] for Step 2
   - If Step 3 needs data from Steps 1 and 2, set dependsOn: [1, 2] for Step 3
   - Steps without dependencies can have dependsOn: [] or omit the field

2. ARGUMENTS FOR AGENTIC TOOLS:
   - If a tool is agentic (can extract parameters from natural language), you can:
     a) Leave arguments empty {} - the tool will extract from context
     b) Provide partial arguments if you know some values
     c) Provide a description in the step description that helps extraction
   - For non-agentic tools, you MUST provide complete arguments

3. STEP DESCRIPTIONS:
   - Be specific about what data to extract or use
   - If a step depends on previous results, mention what data to use
   - Example: "Calculate the sum of the numbers from Step 1" instead of just "Calculate sum"

Return your response as structured data with:
- plan: A high-level description of the overall plan
- steps: An array of steps, each with:
  - stepNumber: Sequential number starting from 1
  - description: Clear description of what this step does and what data to use
  - tool: Name of the tool to use
  - arguments: Arguments object (can be empty {} for agentic tools - they will extract from context)
  - dependsOn: Array of step numbers this step depends on (e.g., [1, 2])
- isComplete: Whether this plan completes the entire task

${hasSystemPrompt ? `4. SYSTEM PROMPT: ${systemPrompt}` : ""}

`;

    const schema: Record<string, unknown> = {
      plan: "string",
      steps: "array",
      isComplete: "boolean",
    };

    try {
      const llmService = this.agent.getLLMService();
      const response = await llmService.getStructuredOutput<PlanningResponse>({
        prompt,
        schema,
        description: isRegeneration
          ? "Regenerated action plan for agent orchestrator"
          : "Action plan for agent orchestrator",
        temperatureOverride: this.planningTemperature,
      });

      if (!response.isValid || !response.structuredData) {
        throw new OrchestratorError(
          `Failed to generate valid plan: ${response.validationErrors?.join(
            ", "
          )}`
        );
      }

      const planData = response.structuredData;
      this.state.plan = planData.plan;
      this.state.conversationHistory.push(
        isRegeneration
          ? `Plan regenerated: ${planData.plan}`
          : `Plan generated: ${planData.plan}`
      );

      this.log(
        `${isRegeneration ? "Regenerated" : "Generated"} plan with ${planData.steps?.length || 0
        } steps`
      );
      return planData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OrchestratorError(`Planning failed: ${errorMessage}`);
    }
  }

  /**
   * Convert planning response to execution steps
   *
   * @private
   * @param {PlanningResponse} planResponse - The planning response
   * @returns {ExecutionStep[]} Array of execution steps
   */
  private convertToExecutionSteps(
    planResponse: PlanningResponse
  ): ExecutionStep[] {
    return (planResponse.steps || []).map((step) => ({
      stepNumber: step.stepNumber,
      description: step.description,
      toolCall: {
        tool: step.tool,
        arguments: step.arguments || {},
      },
      completed: false,
      dependsOn: step.dependsOn || [],
    }));
  }

  /**
   * Determine next step using LLM based on current state
   *
   * @private
   * @returns {Promise<NextStepResponse>} Decision about next step
   * @throws {OrchestratorError} When decision making fails
   */
  private async determineNextStep(): Promise<NextStepResponse> {
    const completedSteps = this.state.steps
      .filter((s) => s.completed)
      .map(
        (s) =>
          `Step ${s.stepNumber}: ${s.description} - Result: ${JSON.stringify(
            s.result
          )}`
      )
      .join("\n");

    const pendingSteps = this.state.steps.filter((s) => !s.completed);
    const currentStep = pendingSteps[0];

    const toolsDescription = this.getToolsDescription();
    const allStepsCompleted =
      this.state.steps.length > 0 && this.state.steps.every((s) => s.completed);

    const prompt = `You are an autonomous agent orchestrator. Analyze the current state and determine the next action.

Original User Query: "${this.state.userQuery}"

Plan: ${this.state.plan || "No plan yet"}

Completed Steps (${this.state.steps.filter((s) => s.completed).length}/${this.state.steps.length
      }):
${completedSteps || "No steps completed yet"}

Pending Steps:
${pendingSteps.length > 0
        ? pendingSteps
          .map(
            (s) =>
              `Step ${s.stepNumber}: ${s.description} (Tool: ${s.toolCall.tool})`
          )
          .join("\n")
        : "No pending steps"
      }

Current Step to Execute:
${currentStep
        ? `Step ${currentStep.stepNumber}: ${currentStep.description} (Tool: ${currentStep.toolCall.tool})`
        : "No more steps in plan"
      }

IMPORTANT: All steps are ${allStepsCompleted ? "COMPLETED" : "NOT completed"}.

Available Tools:
${toolsDescription}

Context from previous steps:
${JSON.stringify(this.state.context, null, 2)}

Determine:
1. If ALL steps are completed AND the user query has been fully satisfied, set shouldContinue: false and provide a finalResponse summarizing the results.
2. If there are pending steps in the plan, set shouldContinue: true (without nextStep) to execute the next planned step.
3. If the plan is incomplete and you need a NEW step not in the plan, set shouldContinue: true and provide nextStep.
4. CRITICAL: If all steps are completed and the task is done, you MUST set shouldContinue: false. Do not continue if the task is complete.

Return your decision as structured data.`;

    const schema: Record<string, unknown> = {
      shouldContinue: "boolean",
      nextStep: "object",
      finalResponse: "string",
      reasoning: "string",
    };

    try {
      const llmService = this.agent.getLLMService();
      const response = await llmService.getStructuredOutput<NextStepResponse>({
        prompt,
        schema,
        description: "Next step decision for agent orchestrator",
        temperatureOverride: this.planningTemperature,
      });

      if (!response.isValid || !response.structuredData) {
        throw new OrchestratorError(
          `Failed to determine next step: ${response.validationErrors?.join(
            ", "
          )}`
        );
      }

      return response.structuredData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OrchestratorError(`Next step decision failed: ${errorMessage}`);
    }
  }

  /**
   * Distill clean context for agentic tools from dependent steps
   * Removes step references and provides only the data needed for extraction
   *
   * @private
   * @param {ExecutionStep} step - The step that needs context
   * @returns {string} Clean, distilled context string with only relevant data
   */
  private distillContextForAgenticTool(step: ExecutionStep): string {
    // Start with the original user query
    let context = `Task: ${this.state.userQuery}`;

    // Add step description to help understand what to extract
    context += `\n\nCurrent action: ${step.description}`;

    // Add distilled data from dependent steps with proper step labels
    if (step.dependsOn && step.dependsOn.length > 0) {
      const dataPoints: string[] = [];

      for (const depStepNum of step.dependsOn) {
        const depStep = this.state.steps.find(
          (s) => s.stepNumber === depStepNum
        );
        if (depStep && depStep.completed && depStep.result !== undefined) {
          // Extract just the data, format it cleanly
          let dataStr = "";
          try {
            if (typeof depStep.result === "string") {
              dataStr = depStep.result;
            } else if (typeof depStep.result === "number") {
              dataStr = depStep.result.toString();
            } else if (typeof depStep.result === "boolean") {
              dataStr = depStep.result.toString();
            } else if (Array.isArray(depStep.result)) {
              dataStr = JSON.stringify(depStep.result);
            } else if (typeof depStep.result === "object") {
              dataStr = JSON.stringify(depStep.result);
            } else {
              dataStr = String(depStep.result);
            }
          } catch {
            dataStr = String(depStep.result);
          }

          // Add data point with step label (step number and description)
          const stepLabel = `Step ${depStep.stepNumber} (${depStep.description}):`;
          dataPoints.push(`${stepLabel}\n${dataStr}`);
        }
      }

      if (dataPoints.length > 0) {
        context += `\n\nAvailable data from previous steps:\n${dataPoints.join(
          "\n\n"
        )}`;
      }
    }

    return context;
  }

  /**
   * Execute a single step
   *
   * @private
   * @param {ExecutionStep} step - The step to execute
   * @returns {Promise<unknown>} Result from tool execution
   * @throws {OrchestratorError} When step execution fails
   */
  private async executeStep(step: ExecutionStep): Promise<unknown> {
    this.log(`Executing step ${step.stepNumber}: ${step.description}`);

    // Check if dependencies are satisfied
    if (step.dependsOn && step.dependsOn.length > 0) {
      const unsatisfiedDeps = step.dependsOn.filter((depNum) => {
        const depStep = this.state.steps.find((s) => s.stepNumber === depNum);
        return !depStep || !depStep.completed;
      });

      if (unsatisfiedDeps.length > 0) {
        throw new OrchestratorError(
          `Step ${step.stepNumber} depends on steps ${unsatisfiedDeps.join(
            ", "
          )} which are not yet completed`,
          step.stepNumber
        );
      }
    }

    this.state.status = "executing";

    try {
      // Orchestrator is responsible for distilling context for agentic tools
      const tool = this.agent
        .getTools()
        .find((t) => t.name === step.toolCall.tool);
      const isAgentic = tool?.agentic ?? false;

      let distilledContext = this.state.userQuery;

      if (isAgentic) {
        // Distill clean context - no step references, just data
        distilledContext = this.distillContextForAgenticTool(step);
        this.log(
          `Distilled context for agentic tool '${step.toolCall.tool
          }': ${distilledContext.substring(0, 100)}...`
        );
      }

      // Build tool call with context if needed
      const toolCallWithContext: ToolCall = {
        ...step.toolCall,
        // Add context for agentic tools if no arguments provided
        ...(isAgentic &&
          (!step.toolCall.arguments ||
            Object.keys(step.toolCall.arguments).length === 0)
          ? { context: distilledContext }
          : {}),
      };

      const result = await this.agent.callTool(toolCallWithContext, true);

      step.completed = true;
      step.result = result;
      this.state.context[`step_${step.stepNumber}_result`] = result;
      this.state.conversationHistory.push(
        `Step ${step.stepNumber} completed: ${step.description}`
      );

      this.log(`Step ${step.stepNumber} completed successfully`);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      step.error = errorMessage;
      this.state.conversationHistory.push(
        `Step ${step.stepNumber} failed: ${errorMessage}`
      );

      this.log(`Step ${step.stepNumber} failed: ${errorMessage}`, "error");
      throw new OrchestratorError(
        `Step ${step.stepNumber} execution failed: ${errorMessage}`,
        step.stepNumber
      );
    }
  }

  /**
   * Execute a user query by planning and executing tool calls step by step
   *
   * @param {string} userQuery - The user's query or task request
   * @returns {Promise<OrchestratorResult>} Promise resolving to the execution result
   * @throws {OrchestratorError} When execution fails
   *
   * @example
   * ```typescript
   * const result = await orchestrator.execute("Calculate the weather for New York");
   * if (result.success) {
   *   console.log(result.finalResponse);
   * }
   * ```
   */
  async execute(userQuery: string, systemPrompt?: string): Promise<OrchestratorResult> {
    // Reset state for new execution
    this.state = this.createInitialState(userQuery);
    this.log(`Starting execution for query: "${userQuery}"`);

    let planRegenerationCount = 0;
    const maxPlanRegenerations = 3;

    try {
      // Generate initial plan
      let planResponse = await this.generatePlan(userQuery, systemPrompt);
      this.state.steps = this.convertToExecutionSteps(planResponse);

      if (planResponse.isComplete && this.state.steps.length === 0) {
        // Task doesn't require any tool calls
        this.state.status = "completed";
        return {
          success: true,
          finalResponse:
            "Task completed successfully without requiring tool calls.",
          steps: [],
          state: this.state,
        };
      }

      // Execute plan sequentially
      while (planRegenerationCount <= maxPlanRegenerations) {
        // Find next step to execute (respecting dependencies)
        const nextStep = this.findNextExecutableStep();

        if (!nextStep) {
          // All steps completed
          this.state.status = "completed";
          this.log("All steps in plan completed successfully");

          // Generate final response
          const finalDecision = await this.determineNextStep();
          return {
            success: true,
            finalResponse:
              finalDecision.finalResponse ||
              "All planned steps completed successfully.",
            steps: this.state.steps.filter((s) => s.completed),
            state: this.state,
          };
        }

        // Check if we've exceeded max steps
        if (this.state.steps.length >= this.maxSteps) {
          this.log(`Reached maximum steps limit (${this.maxSteps})`, "warn");
          this.state.status = "completed";
          return {
            success: true,
            finalResponse: "Execution completed (reached maximum steps limit).",
            steps: this.state.steps.filter((s) => s.completed),
            state: this.state,
          };
        }

        // Execute the step
        try {
          this.state.currentStepIndex = nextStep.stepNumber - 1;
          await this.executeStep(nextStep);
        } catch (stepError) {
          // Step failed - regenerate plan
          this.log(
            `Step ${nextStep.stepNumber} failed, regenerating plan...`,
            "warn"
          );

          if (planRegenerationCount >= maxPlanRegenerations) {
            // Too many regenerations, give up
            this.state.status = "error";
            const errorMessage =
              stepError instanceof Error
                ? stepError.message
                : String(stepError);
            this.state.error = errorMessage;
            return {
              success: false,
              finalResponse: `Execution failed after ${maxPlanRegenerations} plan regenerations: ${errorMessage}`,
              steps: this.state.steps.filter((s) => s.completed),
              state: this.state,
              error: errorMessage,
            };
          }

          // Get completed steps for plan regeneration
          const completedSteps = this.state.steps.filter((s) => s.completed);

          // Regenerate plan with context
          planRegenerationCount++;
          planResponse = await this.generatePlan(
            userQuery,
            systemPrompt,
            planResponse,
            completedSteps
          );

          // Merge new plan steps with existing completed steps
          // Re-number new steps to continue from where we left off
          const maxStepNumber = Math.max(
            ...this.state.steps.map((s) => s.stepNumber),
            0
          );
          const newSteps = this.convertToExecutionSteps(planResponse);

          // Update step numbers to continue sequence
          newSteps.forEach((step, index) => {
            step.stepNumber = maxStepNumber + index + 1;
          });

          // Replace incomplete steps with new plan steps
          const incompleteSteps = this.state.steps.filter((s) => !s.completed);
          this.state.steps = [
            ...completedSteps,
            ...newSteps.filter(
              (newStep) =>
                !completedSteps.some(
                  (cs) => cs.stepNumber === newStep.stepNumber
                )
            ),
          ];

          this.log(
            `Plan regenerated. Continuing with ${this.state.steps.length} total steps`
          );
          // Continue loop to execute next step
          continue;
        }
      }

      // Reached max plan regenerations
      this.state.status = "completed";
      return {
        success: true,
        finalResponse:
          "Execution completed (reached maximum plan regenerations).",
        steps: this.state.steps.filter((s) => s.completed),
        state: this.state,
      };
    } catch (error) {
      this.state.status = "error";
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.state.error = errorMessage;

      this.log(`Execution failed: ${errorMessage}`, "error");
      return {
        success: false,
        finalResponse: `Execution failed: ${errorMessage}`,
        steps: this.state.steps.filter((s) => s.completed),
        state: this.state,
        error: errorMessage,
      };
    }
  }

  /**
   * Find the next executable step that has all dependencies satisfied
   *
   * @private
   * @returns {ExecutionStep | null} Next executable step or null if all done
   */
  private findNextExecutableStep(): ExecutionStep | null {
    // Find steps that are not completed
    const pendingSteps = this.state.steps.filter((s) => !s.completed);

    if (pendingSteps.length === 0) {
      return null;
    }

    // Find steps with all dependencies satisfied
    const executableSteps = pendingSteps.filter((step) => {
      if (!step.dependsOn || step.dependsOn.length === 0) {
        return true; // No dependencies, can execute
      }

      // Check if all dependencies are completed
      return step.dependsOn.every((depNum) => {
        const depStep = this.state.steps.find((s) => s.stepNumber === depNum);
        return depStep && depStep.completed;
      });
    });

    if (executableSteps.length === 0) {
      // No executable steps (circular dependency or missing dependencies)
      // Return the first pending step anyway (will fail with dependency error)
      return pendingSteps[0] || null;
    }

    // Return the step with the lowest step number
    return executableSteps.reduce((min, step) =>
      step.stepNumber < min.stepNumber ? step : min
    );
  }

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
  getState(): OrchestratorState {
    return { ...this.state };
  }

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
  reset(): void {
    this.state = this.createInitialState("");
    this.log("Orchestrator state reset");
  }

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
  async continue(): Promise<OrchestratorResult> {
    if (this.state.status === "completed") {
      return {
        success: true,
        finalResponse: "Execution already completed.",
        steps: this.state.steps.filter((s) => s.completed),
        state: this.state,
      };
    }

    if (this.state.status === "idle") {
      throw new OrchestratorError(
        "Cannot continue: No execution in progress. Call execute() first."
      );
    }

    this.log("Continuing execution from current state");

    try {
      // Continue execution loop
      let iterations = 0;
      while (iterations < this.maxIterations) {
        iterations++;

        // Check if we've exceeded max steps
        if (this.state.steps.length >= this.maxSteps) {
          this.log(`Reached maximum steps limit (${this.maxSteps})`, "warn");
          break;
        }

        // Check if all steps are already completed
        const allStepsCompleted =
          this.state.steps.length > 0 &&
          this.state.steps.every((s) => s.completed);

        if (allStepsCompleted) {
          // All steps completed, check with LLM if task is done
          const decision = await this.determineNextStep();
          if (!decision.shouldContinue) {
            // Task is complete
            this.state.status = "completed";
            this.log("Task completed successfully - all steps done");
            return {
              success: true,
              finalResponse:
                decision.finalResponse || "All steps completed successfully.",
              steps: this.state.steps.filter((s) => s.completed),
              state: this.state,
            };
          }
          // LLM says we need more steps, continue
        }

        // Determine next step
        const decision = await this.determineNextStep();

        if (!decision.shouldContinue) {
          // Task is complete
          this.state.status = "completed";
          this.log("Task completed successfully");
          return {
            success: true,
            finalResponse:
              decision.finalResponse || "Task completed successfully.",
            steps: this.state.steps.filter((s) => s.completed),
            state: this.state,
          };
        }

        // Execute current step or new step
        let stepToExecute: ExecutionStep | null = null;

        if (decision.nextStep) {
          // LLM decided we need a new step
          const newStep: ExecutionStep = {
            stepNumber: this.state.steps.length + 1,
            description: decision.nextStep.description,
            toolCall: {
              tool: decision.nextStep.tool,
              arguments: decision.nextStep.arguments || {},
            },
            completed: false,
          };
          this.state.steps.push(newStep);
          stepToExecute = newStep;
        } else {
          // Execute next pending step from plan
          const pendingStep = this.state.steps.find((s) => !s.completed);
          if (pendingStep) {
            stepToExecute = pendingStep;
          }
        }

        if (!stepToExecute) {
          // No more steps to execute - check one more time with LLM
          const finalDecision = await this.determineNextStep();
          if (!finalDecision.shouldContinue) {
            this.state.status = "completed";
            return {
              success: true,
              finalResponse:
                finalDecision.finalResponse ||
                "All planned steps completed successfully.",
              steps: this.state.steps.filter((s) => s.completed),
              state: this.state,
            };
          }
          // If LLM still says continue but no step found, break to avoid infinite loop
          this.log(
            "No steps to execute but LLM says continue - stopping to prevent infinite loop",
            "warn"
          );
          break;
        }

        // Execute the step
        this.state.currentStepIndex = stepToExecute.stepNumber - 1;
        await this.executeStep(stepToExecute);

        // After executing, check if all steps are now completed
        const allCompleted = this.state.steps.every((s) => s.completed);
        if (allCompleted) {
          // All steps done, ask LLM for final response
          const completionDecision = await this.determineNextStep();
          if (!completionDecision.shouldContinue) {
            this.state.status = "completed";
            this.log("Task completed successfully - all steps executed");
            return {
              success: true,
              finalResponse:
                completionDecision.finalResponse ||
                "All steps completed successfully.",
              steps: this.state.steps.filter((s) => s.completed),
              state: this.state,
            };
          }
          // If LLM says continue but all steps done, break to prevent loop
          this.log(
            "All steps completed but LLM says continue - stopping to prevent infinite loop",
            "warn"
          );
          break;
        }
      }

      this.state.status = "completed";
      return {
        success: true,
        finalResponse: "Execution completed (reached maximum iterations).",
        steps: this.state.steps.filter((s) => s.completed),
        state: this.state,
      };
    } catch (error) {
      this.state.status = "error";
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.state.error = errorMessage;

      this.log(`Continue execution failed: ${errorMessage}`, "error");
      return {
        success: false,
        finalResponse: `Execution failed: ${errorMessage}`,
        steps: this.state.steps.filter((s) => s.completed),
        state: this.state,
        error: errorMessage,
      };
    }
  }
}

/**
 * Create a new orchestrator with the given configuration
 *
 * @param {OrchestratorConfig} config - Configuration object with agent and settings
 * @returns {Orchestrator} New Orchestrator instance
 *
 * @example
 * ```typescript
 * const orchestrator = createOrchestrator({
 *   agent: agentInstance,
 *   maxSteps: 10,
 *   verbose: true
 * });
 * ```
 */
export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}

// Re-export types for convenience
export type {
  OrchestratorConfig,
  OrchestratorState,
  OrchestratorResult,
  OrchestratorStatus,
  ExecutionStep,
};
export { OrchestratorError };
