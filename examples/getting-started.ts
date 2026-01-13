/**
 * Agent Builder - Getting Started Example
 *
 * This example demonstrates the basic usage of the Agent Builder library.
 * Run with: npx ts-node examples/getting-started.ts
 *
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 * - npm install
 */

import {
    LLMService,
    Agent,
    Orchestrator,
    createTool,
    AgentError,
    OrchestratorError,
    // Zod-based type-safe tools
    z,
    defineToolWithZod,
    typedToolToTool,
} from "../index";

// ============================================
// Step 1: Initialize LLM Service
// ============================================

const llmService = new LLMService({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 1000,
});

console.log("✅ LLM Service initialized");

// ============================================
// Step 2: Create Tools (Using Zod for Type Safety)
// ============================================

// NEW: Using Zod schemas for full type inference
// The execute function gets properly typed arguments!

// Calculator with type-safe add operation
const addTool = defineToolWithZod({
    name: "add",
    description: "Adds two numbers together",
    schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
    }),
    execute: async (args) => {
        // ✅ args is typed as { a: number; b: number }
        const result = args.a + args.b;
        console.log(`  📊 add(${args.a}, ${args.b}) = ${result}`);
        return result;
    },
});

// Calculator with type-safe multiply operation
const multiplyTool = defineToolWithZod({
    name: "multiply",
    description: "Multiplies two numbers together",
    schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
    }),
    execute: async (args) => {
        // ✅ args is typed as { a: number; b: number }
        const result = args.a * args.b;
        console.log(`  📊 multiply(${args.a}, ${args.b}) = ${result}`);
        return result;
    },
});

// Agentic tool with enum support
const greetTool = defineToolWithZod({
    name: "greet",
    description: "Greets a person by name with a custom message",
    schema: z.object({
        name: z.string().describe("Name of the person to greet"),
        style: z.enum(["formal", "casual", "enthusiastic"]).describe("Style of greeting"),
    }),
    execute: async (args) => {
        // ✅ args is typed as { name: string; style: "formal" | "casual" | "enthusiastic" }
        let greeting: string;
        switch (args.style) {
            case "formal":
                greeting = `Good day, ${args.name}. It is a pleasure to meet you.`;
                break;
            case "enthusiastic":
                greeting = `Hey ${args.name}!!! So excited to see you! 🎉`;
                break;
            case "casual":
            default:
                greeting = `Hey ${args.name}, what's up?`;
        }
        console.log(`  💬 ${greeting}`);
        return greeting;
    },
    agentic: true, // This tool can extract parameters from context
});

console.log("✅ Tools created with Zod: add, multiply, greet");


// ============================================
// Step 3: Create Agent
// ============================================

// Convert TypedTools to regular Tools for the Agent
const agent = new Agent({
    tools: [
        typedToolToTool(addTool),
        typedToolToTool(multiplyTool),
        typedToolToTool(greetTool),
    ],
    llmService: llmService,
    maxRetries: 3,
    retryDelay: 1000,
    verbose: false, // Set to true for detailed logging
});

console.log("✅ Agent initialized with 3 tools");

// ============================================
// Step 4: Use the Agent
// ============================================

async function demonstrateAgent() {
    console.log("\n" + "=".repeat(50));
    console.log("AGENT DEMONSTRATION");
    console.log("=".repeat(50));

    // Example 1: Direct tool call with explicit arguments
    console.log("\n📌 Example 1: Direct tool call");
    try {
        const sum = await agent.callTool({
            tool: "add",
            arguments: { a: 10, b: 25 },
        });
        console.log(`  Result: ${sum}`);
    } catch (error) {
        console.error("  Error:", error);
    }

    // Example 2: Multiple tool calls in sequence
    console.log("\n📌 Example 2: Sequential tool calls");
    try {
        const results = await agent.callTools([
            { tool: "add", arguments: { a: 5, b: 3 } },
            { tool: "multiply", arguments: { a: 4, b: 7 } },
        ]);
        console.log(`  Results: ${JSON.stringify(results)}`);
    } catch (error) {
        console.error("  Error:", error);
    }

    // Example 3: Agentic tool call (LLM extracts parameters)
    console.log("\n📌 Example 3: Agentic tool call");
    try {
        const greeting = await agent.callTool({
            tool: "greet",
            context: "Say hello to Alice in an enthusiastic way!",
        });
        console.log(`  Result: ${greeting}`);
    } catch (error) {
        if (error instanceof AgentError) {
            console.error(`  Agent Error: ${error.message}`);
        } else {
            console.error("  Error:", error);
        }
    }

    // Example 4: Tool validation
    console.log("\n📌 Example 4: Tool validation");
    const validation = agent.validateToolCall({
        tool: "add",
        arguments: { a: "not a number", b: 5 },
    });
    console.log(`  Valid: ${validation.valid}`);
    if (!validation.valid) {
        console.log(`  Errors: ${validation.errors?.join(", ")}`);
    }
}

// ============================================
// Step 5: Create and Use Orchestrator
// ============================================

async function demonstrateOrchestrator() {
    console.log("\n" + "=".repeat(50));
    console.log("ORCHESTRATOR DEMONSTRATION");
    console.log("=".repeat(50));

    const orchestrator = new Orchestrator({
        agent: agent,
        maxSteps: 10,
        maxIterations: 5,
        verbose: false, // Set to true for detailed logging
    });

    console.log("✅ Orchestrator initialized");

    // Execute a complex multi-step task
    console.log("\n📌 Executing: 'Add 15 and 25, then multiply the result by 2'");

    try {
        const result = await orchestrator.execute(
            "Add 15 and 25, then multiply the result by 2"
        );

        console.log("\n📋 Execution Result:");
        console.log(`  Success: ${result.success}`);
        console.log(`  Final Response: ${result.finalResponse}`);
        console.log(`  Steps Executed: ${result.steps.length}`);

        if (result.steps.length > 0) {
            console.log("\n  Step Details:");
            result.steps.forEach((step, i) => {
                console.log(`    ${i + 1}. ${step.description}`);
                console.log(`       Tool: ${step.toolCall.tool}`);
                console.log(`       Result: ${JSON.stringify(step.result)}`);
            });
        }
    } catch (error) {
        if (error instanceof OrchestratorError) {
            console.error(`Orchestrator Error at step ${error.stepNumber}: ${error.message}`);
        } else {
            console.error("Error:", error);
        }
    }

    // Check orchestrator state
    const state = orchestrator.getState();
    console.log(`\n📊 Final Orchestrator State: ${state.status}`);
}

// ============================================
// Main Execution
// ============================================

async function main() {
    console.log("\n🚀 Agent Builder - Getting Started Example\n");

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
        console.error("❌ Error: OPENAI_API_KEY environment variable is not set");
        console.log("\nTo run this example:");
        console.log("  export OPENAI_API_KEY=your-api-key-here");
        console.log("  npx ts-node examples/getting-started.ts");
        process.exit(1);
    }

    try {
        await demonstrateAgent();
        await demonstrateOrchestrator();

        console.log("\n" + "=".repeat(50));
        console.log("✅ All demonstrations completed successfully!");
        console.log("=".repeat(50));
    } catch (error) {
        console.error("\n❌ An error occurred:", error);
        process.exit(1);
    }
}

main();
