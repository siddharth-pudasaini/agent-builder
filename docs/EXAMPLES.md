# Examples & Tutorials

Practical examples and step-by-step tutorials for using the Agent Builder library.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Building a Calculator Agent](#2-building-a-calculator-agent)
3. [Creating an Agentic Weather Assistant](#3-creating-an-agentic-weather-assistant)
4. [Multi-Tool Orchestration](#4-multi-tool-orchestration)
5. [Building a Research Assistant](#5-building-a-research-assistant)
6. [Custom Error Handling](#6-custom-error-handling)
7. [Testing Your Agents](#7-testing-your-agents)

---

## 1. Getting Started

### Minimal Setup

```typescript
import { LLMService, Agent, createTool } from 'agent-builder';

// Step 1: Initialize LLM Service
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!
});

// Step 2: Create a simple tool
const helloTool = createTool(
  'say_hello',
  'Says hello to a person',
  { name: { type: 'string', description: 'Name of the person' } },
  async ({ name }) => `Hello, ${name}!`
);

// Step 3: Create agent
const agent = new Agent({
  tools: [helloTool],
  llmService
});

// Step 4: Use the agent
const result = await agent.callTool({
  tool: 'say_hello',
  arguments: { name: 'World' }
});

console.log(result); // "Hello, World!"
```

---

## 2. Building a Calculator Agent

A complete calculator agent with multiple operations.

```typescript
import { LLMService, Agent, Orchestrator, createTool } from 'agent-builder';

// Initialize LLM
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

// Create arithmetic tools
const addTool = createTool(
  'add',
  'Adds two numbers together',
  {
    a: { type: 'number', description: 'First number' },
    b: { type: 'number', description: 'Second number' }
  },
  async ({ a, b }) => {
    const result = a + b;
    return { operation: 'addition', a, b, result };
  },
  { agentic: true }
);

const subtractTool = createTool(
  'subtract',
  'Subtracts second number from first',
  {
    a: { type: 'number', description: 'Number to subtract from' },
    b: { type: 'number', description: 'Number to subtract' }
  },
  async ({ a, b }) => {
    const result = a - b;
    return { operation: 'subtraction', a, b, result };
  },
  { agentic: true }
);

const multiplyTool = createTool(
  'multiply',
  'Multiplies two numbers',
  {
    a: { type: 'number', description: 'First number' },
    b: { type: 'number', description: 'Second number' }
  },
  async ({ a, b }) => {
    const result = a * b;
    return { operation: 'multiplication', a, b, result };
  },
  { agentic: true }
);

const divideTool = createTool(
  'divide',
  'Divides first number by second',
  {
    a: { type: 'number', description: 'Dividend (number to divide)' },
    b: { type: 'number', description: 'Divisor (number to divide by)' }
  },
  async ({ a, b }) => {
    if (b === 0) throw new Error('Cannot divide by zero');
    const result = a / b;
    return { operation: 'division', a, b, result };
  },
  { agentic: true }
);

// Create agent with all tools
const agent = new Agent({
  tools: [addTool, subtractTool, multiplyTool, divideTool],
  llmService,
  verbose: true
});

// Create orchestrator for complex calculations
const orchestrator = new Orchestrator({
  agent,
  maxSteps: 10,
  verbose: true
});

// Example: Direct tool call
async function directCalculation() {
  const result = await agent.callTool({
    tool: 'add',
    arguments: { a: 15, b: 27 }
  });
  console.log('Direct result:', result);
  // { operation: 'addition', a: 15, b: 27, result: 42 }
}

// Example: Agentic tool call (LLM extracts parameters)
async function agenticCalculation() {
  const result = await agent.callTool({
    tool: 'multiply',
    context: 'What is 7 times 8?'
  });
  console.log('Agentic result:', result);
  // { operation: 'multiplication', a: 7, b: 8, result: 56 }
}

// Example: Complex multi-step calculation
async function complexCalculation() {
  const result = await orchestrator.execute(
    'Calculate (10 + 5) * 3, then subtract 15 from the result'
  );
  
  console.log('Complex calculation result:');
  console.log('Success:', result.success);
  console.log('Final response:', result.finalResponse);
  console.log('Steps:');
  result.steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.description}`);
    console.log(`     Result: ${JSON.stringify(step.result)}`);
  });
}

// Run examples
directCalculation();
agenticCalculation();
complexCalculation();
```

---

## 3. Creating an Agentic Weather Assistant

A weather assistant that can understand natural language queries.

```typescript
import { LLMService, Agent, createTool } from 'agent-builder';

// Simulated weather API
interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

async function fetchWeatherFromAPI(city: string): Promise<WeatherData> {
  // In production, this would call a real weather API
  const mockData: Record<string, WeatherData> = {
    'new york': { city: 'New York', temperature: 22, condition: 'sunny', humidity: 45, windSpeed: 12 },
    'london': { city: 'London', temperature: 15, condition: 'cloudy', humidity: 78, windSpeed: 8 },
    'tokyo': { city: 'Tokyo', temperature: 28, condition: 'partly cloudy', humidity: 65, windSpeed: 5 },
  };
  
  const normalizedCity = city.toLowerCase();
  if (normalizedCity in mockData) {
    return mockData[normalizedCity];
  }
  
  // Random data for unknown cities
  return {
    city,
    temperature: Math.floor(Math.random() * 30) + 5,
    condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
    humidity: Math.floor(Math.random() * 60) + 30,
    windSpeed: Math.floor(Math.random() * 20) + 2
  };
}

// Create weather tools
const getCurrentWeatherTool = createTool(
  'get_current_weather',
  'Gets the current weather for a specified city',
  {
    city: { 
      type: 'string', 
      description: 'Name of the city to get weather for (e.g., "New York", "London", "Tokyo")' 
    }
  },
  async ({ city }) => {
    const weather = await fetchWeatherFromAPI(city as string);
    return weather;
  },
  { 
    agentic: true,
    systemPrompt: 'Extract the city name from the user query. Handle common variations like "NYC" for "New York".'
  }
);

const getWeatherComparisonTool = createTool(
  'compare_weather',
  'Compares weather between two cities',
  {
    city1: { type: 'string', description: 'First city name' },
    city2: { type: 'string', description: 'Second city name' }
  },
  async ({ city1, city2 }) => {
    const weather1 = await fetchWeatherFromAPI(city1 as string);
    const weather2 = await fetchWeatherFromAPI(city2 as string);
    
    return {
      city1: weather1,
      city2: weather2,
      temperatureDiff: weather1.temperature - weather2.temperature,
      warmerCity: weather1.temperature > weather2.temperature ? weather1.city : weather2.city
    };
  },
  { 
    agentic: true,
    systemPrompt: 'Extract both city names from the query for weather comparison.'
  }
);

const getWeatherRecommendationTool = createTool(
  'get_weather_recommendation',
  'Provides activity recommendations based on weather conditions',
  {
    city: { type: 'string', description: 'City to get recommendations for' }
  },
  async ({ city }) => {
    const weather = await fetchWeatherFromAPI(city as string);
    
    let recommendation: string;
    if (weather.condition === 'sunny' && weather.temperature > 20) {
      recommendation = 'Perfect day for outdoor activities! Consider going to a park or beach.';
    } else if (weather.condition === 'rainy') {
      recommendation = 'Best to stay indoors. Good day for a museum or cafe visit.';
    } else if (weather.temperature < 10) {
      recommendation = 'Bundle up if going outside. Indoor activities recommended.';
    } else {
      recommendation = 'Moderate weather. Light jacket recommended for outdoor activities.';
    }
    
    return {
      ...weather,
      recommendation
    };
  },
  { agentic: true }
);

// Initialize
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

const weatherAgent = new Agent({
  tools: [getCurrentWeatherTool, getWeatherComparisonTool, getWeatherRecommendationTool],
  llmService,
  verbose: true
});

// Usage examples
async function weatherExamples() {
  // Simple weather query
  console.log('\n--- Simple Weather Query ---');
  const newYorkWeather = await weatherAgent.callTool({
    tool: 'get_current_weather',
    context: 'What is the weather like in New York City right now?'
  });
  console.log('New York weather:', newYorkWeather);

  // Weather comparison
  console.log('\n--- Weather Comparison ---');
  const comparison = await weatherAgent.callTool({
    tool: 'compare_weather',
    context: 'Is it warmer in London or Tokyo?'
  });
  console.log('Comparison:', comparison);

  // Weather with recommendation
  console.log('\n--- Weather Recommendation ---');
  const recommendation = await weatherAgent.callTool({
    tool: 'get_weather_recommendation',
    context: 'Should I do outdoor activities in London today?'
  });
  console.log('Recommendation:', recommendation);
}

weatherExamples();
```

---

## 4. Multi-Tool Orchestration

Complex task execution using the orchestrator.

```typescript
import { LLMService, Agent, Orchestrator, createTool } from 'agent-builder';

// Simulated database
const usersDB: Record<string, { name: string; email: string; preferences: string[] }> = {
  'user_1': { name: 'Alice', email: 'alice@example.com', preferences: ['tech', 'science'] },
  'user_2': { name: 'Bob', email: 'bob@example.com', preferences: ['sports', 'music'] },
};

const notificationLog: Array<{ userId: string; message: string; timestamp: Date }> = [];

// Create tools
const getUserTool = createTool(
  'get_user',
  'Retrieves user information by ID',
  {
    userId: { type: 'string', description: 'The user ID (e.g., user_1, user_2)' }
  },
  async ({ userId }) => {
    const user = usersDB[userId as string];
    if (!user) throw new Error(`User ${userId} not found`);
    return { userId, ...user };
  },
  { agentic: true }
);

const sendEmailTool = createTool(
  'send_email',
  'Sends an email to a user',
  {
    email: { type: 'string', description: 'Recipient email address' },
    subject: { type: 'string', description: 'Email subject line' },
    body: { type: 'string', description: 'Email body content' }
  },
  async ({ email, subject, body }) => {
    // Simulated email sending
    console.log(`📧 Sending email to ${email}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${body}`);
    return { 
      success: true, 
      messageId: `msg_${Date.now()}`,
      recipient: email
    };
  },
  { 
    agentic: true,
    systemPrompt: 'Create a professional and friendly email based on the context.'
  }
);

const logNotificationTool = createTool(
  'log_notification',
  'Logs a notification for a user',
  {
    userId: { type: 'string', description: 'User ID to notify' },
    message: { type: 'string', description: 'Notification message' }
  },
  async ({ userId, message }) => {
    const notification = {
      userId: userId as string,
      message: message as string,
      timestamp: new Date()
    };
    notificationLog.push(notification);
    return { logged: true, notification };
  },
  { agentic: true }
);

const getContentRecommendationTool = createTool(
  'get_recommendations',
  'Gets content recommendations based on user preferences',
  {
    preferences: { 
      type: 'array', 
      description: 'Array of user preference tags',
      items: { type: 'string' }
    }
  },
  async ({ preferences }) => {
    const prefs = preferences as string[];
    const recommendations: Record<string, string[]> = {
      'tech': ['New AI breakthrough', 'Latest smartphone reviews'],
      'science': ['Space exploration updates', 'Climate research findings'],
      'sports': ['Championship highlights', 'Transfer news'],
      'music': ['New album releases', 'Concert announcements']
    };
    
    const results: string[] = [];
    for (const pref of prefs) {
      if (recommendations[pref]) {
        results.push(...recommendations[pref]);
      }
    }
    
    return { preferences: prefs, recommendations: results };
  }
);

// Initialize
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
  temperature: 0.7
});

const agent = new Agent({
  tools: [getUserTool, sendEmailTool, logNotificationTool, getContentRecommendationTool],
  llmService,
  maxRetries: 3,
  verbose: true
});

const orchestrator = new Orchestrator({
  agent,
  maxSteps: 15,
  maxIterations: 5,
  verbose: true,
  planningTemperature: 0.7
});

// Execute complex task
async function runComplexTask() {
  const result = await orchestrator.execute(
    `Get user information for user_1, then based on their preferences, 
     get content recommendations and send them an email with the recommendations. 
     Finally, log a notification that the newsletter was sent.`
  );

  console.log('\n========================================');
  console.log('ORCHESTRATION RESULT');
  console.log('========================================');
  console.log('Success:', result.success);
  console.log('\nFinal Response:', result.finalResponse);
  console.log('\nExecution Timeline:');
  result.steps.forEach((step, i) => {
    console.log(`\n[Step ${step.stepNumber}] ${step.description}`);
    console.log(`  Tool: ${step.toolCall.tool}`);
    console.log(`  Completed: ${step.completed ? '✅' : '❌'}`);
    if (step.result) {
      console.log(`  Result: ${JSON.stringify(step.result, null, 2).substring(0, 200)}...`);
    }
    if (step.error) {
      console.log(`  Error: ${step.error}`);
    }
  });
  
  console.log('\n\nNotification Log:', notificationLog);
}

runComplexTask();
```

---

## 5. Building a Research Assistant

An agent that can search, summarize, and compile research.

```typescript
import { LLMService, Agent, Orchestrator, createTool } from 'agent-builder';

// Simulated search results
async function simulateWebSearch(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  // In production, this would call a real search API
  return [
    {
      title: `Result 1 for "${query}"`,
      url: `https://example.com/article1?q=${encodeURIComponent(query)}`,
      snippet: `This is a relevant snippet about ${query}. It contains information that might be useful for research.`
    },
    {
      title: `Result 2 for "${query}"`,
      url: `https://example.com/article2?q=${encodeURIComponent(query)}`,
      snippet: `Another perspective on ${query}. Different sources provide varying viewpoints.`
    },
    {
      title: `Result 3 for "${query}"`,
      url: `https://example.com/article3?q=${encodeURIComponent(query)}`,
      snippet: `Academic research about ${query}. Peer-reviewed and credible source.`
    }
  ];
}

// Create research tools
const webSearchTool = createTool(
  'web_search',
  'Searches the web for information on a topic',
  {
    query: { 
      type: 'string', 
      description: 'The search query to look up' 
    },
    maxResults: {
      type: 'integer',
      description: 'Maximum number of results to return',
      minimum: 1,
      maximum: 10
    }
  },
  async ({ query, maxResults }) => {
    const results = await simulateWebSearch(query as string);
    return results.slice(0, maxResults as number || 5);
  },
  { agentic: true }
);

const summarizeTool = createTool(
  'summarize_content',
  'Summarizes content from search results or text',
  {
    content: { 
      type: 'string', 
      description: 'The content to summarize' 
    },
    style: {
      type: 'string',
      enum: ['brief', 'detailed', 'bullet_points'],
      description: 'Summarization style'
    }
  },
  async ({ content, style }) => {
    // In a real implementation, you might use an LLM for summarization
    const text = content as string;
    const summaryStyle = style as string;
    
    let summary: string;
    switch (summaryStyle) {
      case 'brief':
        summary = text.substring(0, 100) + '...';
        break;
      case 'bullet_points':
        summary = `• Key point 1 from content\n• Key point 2 from content\n• Key point 3 from content`;
        break;
      case 'detailed':
      default:
        summary = `Detailed Summary: ${text.substring(0, 300)}...`;
    }
    
    return { 
      originalLength: text.length, 
      summaryStyle: summaryStyle,
      summary 
    };
  },
  { agentic: true }
);

const compileReportTool = createTool(
  'compile_report',
  'Compiles a research report from multiple sources',
  {
    topic: { type: 'string', description: 'Main research topic' },
    sections: {
      type: 'array',
      description: 'Report sections',
      items: { type: 'string' }
    },
    format: {
      type: 'string',
      enum: ['markdown', 'plain'],
      description: 'Output format'
    }
  },
  async ({ topic, sections, format }) => {
    const reportTopic = topic as string;
    const reportSections = sections as string[];
    const outputFormat = format as string;
    
    let report: string;
    if (outputFormat === 'markdown') {
      report = `# Research Report: ${reportTopic}\n\n`;
      reportSections.forEach((section, i) => {
        report += `## Section ${i + 1}\n\n${section}\n\n`;
      });
    } else {
      report = `RESEARCH REPORT: ${reportTopic}\n\n`;
      reportSections.forEach((section, i) => {
        report += `Section ${i + 1}:\n${section}\n\n`;
      });
    }
    
    return {
      topic: reportTopic,
      sectionCount: reportSections.length,
      format: outputFormat,
      report
    };
  }
);

const saveFileTool = createTool(
  'save_file',
  'Saves content to a file',
  {
    filename: { type: 'string', description: 'Name of the file' },
    content: { type: 'string', description: 'Content to save' }
  },
  async ({ filename, content }) => {
    // Simulated file save
    console.log(`💾 Saving to ${filename}...`);
    // In production: await fs.writeFile(filename, content);
    return { 
      saved: true, 
      filename: filename as string, 
      size: (content as string).length 
    };
  }
);

// Initialize
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

const researchAgent = new Agent({
  tools: [webSearchTool, summarizeTool, compileReportTool, saveFileTool],
  llmService,
  verbose: true
});

const orchestrator = new Orchestrator({
  agent: researchAgent,
  maxSteps: 20,
  verbose: true
});

// Run research task
async function conductResearch() {
  const result = await orchestrator.execute(
    `Research the topic "artificial intelligence in healthcare". 
     Search for information, summarize the key findings in bullet points, 
     compile a report in markdown format, and save it to a file called "ai_healthcare_report.md".`
  );

  console.log('\n========================================');
  console.log('RESEARCH COMPLETED');
  console.log('========================================');
  console.log('Success:', result.success);
  console.log('Steps executed:', result.steps.length);
  console.log('\nFinal Response:');
  console.log(result.finalResponse);
}

conductResearch();
```

---

## 6. Custom Error Handling

Implementing robust error handling patterns.

```typescript
import { 
  LLMService, 
  Agent, 
  Orchestrator, 
  createTool,
  AgentError,
  LLMServiceError,
  OrchestratorError
} from 'agent-builder';

// Create a tool that might fail
const unreliableTool = createTool(
  'unreliable_service',
  'A service that sometimes fails',
  {
    successRate: { 
      type: 'number', 
      description: 'Probability of success (0-1)',
      minimum: 0,
      maximum: 1
    }
  },
  async ({ successRate }) => {
    const rate = successRate as number;
    if (Math.random() > rate) {
      throw new Error('Service temporarily unavailable');
    }
    return { status: 'success', timestamp: new Date().toISOString() };
  }
);

// Initialize with retry logic
const llmService = new LLMService({
  apiKey: process.env.OPENAI_API_KEY!
});

const agent = new Agent({
  tools: [unreliableTool],
  llmService,
  maxRetries: 5,        // Retry up to 5 times
  retryDelay: 2000,     // Wait 2 seconds between retries
  verbose: true
});

// Pattern 1: Basic error handling
async function basicErrorHandling() {
  try {
    const result = await agent.callTool({
      tool: 'unreliable_service',
      arguments: { successRate: 0.3 }  // 30% success rate
    });
    console.log('Success:', result);
  } catch (error) {
    if (error instanceof AgentError) {
      console.error(`Agent error in tool "${error.toolName}"`);
      console.error(`Failed after ${error.retryCount} retries`);
      console.error(`Message: ${error.message}`);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Pattern 2: LLM service error handling
async function llmErrorHandling() {
  const badLLMService = new LLMService({
    apiKey: 'invalid-key',
    baseUrl: 'https://api.openai.com/v1'
  });

  try {
    await badLLMService.getResponse('Hello');
  } catch (error) {
    if (error instanceof LLMServiceError) {
      console.error(`LLM service error during: ${error.operation}`);
      console.error(`Status code: ${error.statusCode}`);
      console.error(`Message: ${error.message}`);
      
      // Handle specific status codes
      if (error.statusCode === 401) {
        console.error('Invalid API key - please check your credentials');
      } else if (error.statusCode === 429) {
        console.error('Rate limited - please wait and try again');
      }
    }
  }
}

// Pattern 3: Orchestrator error handling with recovery
async function orchestratorErrorHandling() {
  const orchestrator = new Orchestrator({
    agent,
    maxSteps: 10,
    verbose: true
  });

  async function executeWithRecovery(query: string, maxAttempts: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`\nAttempt ${attempt}/${maxAttempts}`);
        const result = await orchestrator.execute(query);
        
        if (result.success) {
          return result;
        } else {
          console.warn(`Attempt ${attempt} failed: ${result.error}`);
          if (attempt < maxAttempts) {
            console.log('Resetting and retrying...');
            orchestrator.reset();
          }
        }
      } catch (error) {
        if (error instanceof OrchestratorError) {
          console.error(`Orchestrator error at step ${error.stepNumber}: ${error.message}`);
          
          // Try to continue from current state
          if (attempt < maxAttempts) {
            console.log('Attempting to continue from current state...');
            try {
              const continueResult = await orchestrator.continue();
              if (continueResult.success) {
                return continueResult;
              }
            } catch (continueError) {
              console.error('Continue failed, resetting...');
              orchestrator.reset();
            }
          }
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    }
    
    throw new Error(`Failed after ${maxAttempts} attempts`);
  }

  try {
    const result = await executeWithRecovery('Call the unreliable service with 50% success rate');
    console.log('Final result:', result);
  } catch (error) {
    console.error('All recovery attempts failed:', error);
  }
}

// Pattern 4: Validation error handling
async function validationErrorHandling() {
  // Pre-validate before calling
  const validation = agent.validateToolCall({
    tool: 'unreliable_service',
    arguments: { successRate: 1.5 }  // Invalid: > 1
  });

  if (!validation.valid) {
    console.error('Validation failed:');
    validation.errors?.forEach(err => console.error(`  - ${err}`));
    
    // Don't even attempt the call
    return;
  }
}

// Run examples
async function runErrorExamples() {
  console.log('=== Basic Error Handling ===');
  await basicErrorHandling();
  
  console.log('\n=== LLM Error Handling ===');
  await llmErrorHandling();
  
  console.log('\n=== Orchestrator Error Handling ===');
  await orchestratorErrorHandling();
  
  console.log('\n=== Validation Error Handling ===');
  await validationErrorHandling();
}

runErrorExamples();
```

---

## 7. Testing Your Agents

Patterns for testing agents and tools.

```typescript
import { LLMService, Agent, createTool, ILLMService } from 'agent-builder';

// Create a mock LLM service for testing
class MockLLMService implements ILLMService {
  private responses: Map<string, any> = new Map();

  setResponse(promptPattern: string, response: any) {
    this.responses.set(promptPattern, response);
  }

  async getResponse(prompt: string, options?: any) {
    for (const [pattern, response] of this.responses) {
      if (prompt.includes(pattern)) {
        return { content: response, usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } };
      }
    }
    return { content: 'Default response', usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } };
  }

  async getStructuredOutput<T>(request: any) {
    for (const [pattern, response] of this.responses) {
      if (request.prompt.includes(pattern)) {
        return {
          content: JSON.stringify(response),
          structuredData: response as T,
          isValid: true,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
        };
      }
    }
    return {
      content: '{}',
      structuredData: {} as T,
      isValid: true,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    };
  }

  async getReasoningResponse(request: any) {
    return this.getResponse(request.prompt);
  }

  validateStructuredOutput<T>(content: string, schema: Record<string, unknown>) {
    try {
      const parsed = JSON.parse(content);
      return { isValid: true, data: parsed as T };
    } catch {
      return { isValid: false, errors: ['Invalid JSON'] };
    }
  }

  getConfig() {
    return {
      apiKey: 'mock-key',
      baseUrl: 'https://mock.api',
      model: 'mock-model',
      temperature: 0.7,
      maxTokens: 1000
    };
  }
}

// Example test cases
describe('Agent Builder Tests', () => {
  let mockLLM: MockLLMService;
  let agent: Agent;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    
    const calculatorTool = createTool(
      'add',
      'Adds two numbers',
      {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      async ({ a, b }) => (a as number) + (b as number)
    );

    agent = new Agent({
      tools: [calculatorTool],
      llmService: mockLLM
    });
  });

  test('should execute tool with explicit arguments', async () => {
    const result = await agent.callTool({
      tool: 'add',
      arguments: { a: 5, b: 3 }
    });

    expect(result).toBe(8);
  });

  test('should validate tool inputs', () => {
    const validation = agent.validateToolCall({
      tool: 'add',
      arguments: { a: 'not a number', b: 3 }
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toBeDefined();
  });

  test('should throw error for unknown tool', async () => {
    await expect(
      agent.callTool({
        tool: 'unknown_tool',
        arguments: {}
      })
    ).rejects.toThrow("Tool 'unknown_tool' not found");
  });

  test('should handle agentic tools with mock LLM', async () => {
    const agenticTool = createTool(
      'smart_add',
      'Adds numbers from context',
      {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      async ({ a, b }) => (a as number) + (b as number),
      { agentic: true }
    );

    agent.addTool(agenticTool);

    // Mock the LLM response for parameter extraction
    mockLLM.setResponse('Extract', { a: 10, b: 20 });

    const result = await agent.callTool({
      tool: 'smart_add',
      context: 'Add ten and twenty together'
    });

    expect(result).toBe(30);
  });

  test('should manage tools dynamically', () => {
    expect(agent.getTools().length).toBe(1);

    const newTool = createTool(
      'subtract',
      'Subtracts two numbers',
      { a: { type: 'number' }, b: { type: 'number' } },
      async ({ a, b }) => (a as number) - (b as number)
    );

    agent.addTool(newTool);
    expect(agent.getTools().length).toBe(2);

    const removed = agent.removeTool('subtract');
    expect(removed).toBe(true);
    expect(agent.getTools().length).toBe(1);
  });
});

// Integration test example
describe('Integration Tests', () => {
  test('should execute multi-step workflow', async () => {
    // Only run if OPENAI_API_KEY is set
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping integration test: OPENAI_API_KEY not set');
      return;
    }

    const llmService = new LLMService({
      apiKey: process.env.OPENAI_API_KEY
    });

    const tools = [
      createTool('step1', 'First step', { input: { type: 'string' } }, 
        async ({ input }) => `Step 1 processed: ${input}`),
      createTool('step2', 'Second step', { input: { type: 'string' } }, 
        async ({ input }) => `Step 2 processed: ${input}`)
    ];

    const agent = new Agent({ tools, llmService });

    const results = await agent.callTools([
      { tool: 'step1', arguments: { input: 'test' } },
      { tool: 'step2', arguments: { input: 'data' } }
    ]);

    expect(results.length).toBe(2);
    expect(results[0]).toContain('Step 1');
    expect(results[1]).toContain('Step 2');
  });
});
```

---

## Next Steps

1. **Explore the API Reference**: See [API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md) for a complete method reference
2. **Read the Main Documentation**: See [README.md](./README.md) for architecture and concepts
3. **Build Your Own Tools**: Start with simple tools and gradually add agentic capabilities
4. **Experiment with Orchestration**: Try complex multi-step tasks to understand planning

---

Happy building! 🚀
