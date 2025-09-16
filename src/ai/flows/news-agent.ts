'use server';
/**
 * @fileOverview A conversational AI agent that can search for news and browse the web.
 *
 * - newsAgent - The main flow that orchestrates the agent's behavior.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { searchNews } from '@/services/news-api';
import { searchWeb, type WebSearchResult } from '@/services/web-search';
import { summarizeHeadlinesDigest } from './summarize-headlines-digest';
import type { NewsAgentInput, NewsAgentOutput } from '@/lib/schemas';
import { NewsAgentInputSchema, NewsAgentOutputSchema } from '@/lib/schemas';


// Define tools for the agent to use
const newsSearchTool = ai.defineTool(
  {
    name: 'searchNews',
    description: 'Search for recent news articles on a given topic. Use this for queries about current events.',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.any(),
  },
  async ({ query }) => searchNews(query)
);

const webSearchTool = ai.defineTool(
  {
    name: 'searchWeb',
    description: 'Search the web for general knowledge questions or information not related to recent news.',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.array(z.object({
        title: z.string(),
        link: z.string(),
        snippet: z.string()
    })),
  },
  async ({ query }) => searchWeb(query)
);

const agentPrompt = ai.definePrompt({
    name: 'newsAgentPrompt',
    input: { schema: NewsAgentInputSchema },
    output: { schema: NewsAgentOutputSchema },
    tools: [newsSearchTool, webSearchTool],
    prompt: `You are a helpful news assistant.
    
    - If the user asks for news (e.g., "latest on AI", "business news"), use the searchNews tool to find relevant articles. Then, rank them by relevance and set the relevanceScore.
    - After fetching news, ALWAYS generate a brief, 1-2 sentence digest of all the headlines combined.
    - If the user asks a general knowledge question (e.g., "when was X invented?"), use the searchWeb tool. Synthesize the web search results into a concise answer for the 'response' field.
    - If you use the searchNews tool, do not populate the 'response' field. The UI will display the articles.
    - If you use the searchWeb tool, populate the 'response' field with the answer and do not return any articles.
    - If the query is unclear, ask for clarification.
    
    User query: '{{{query}}}'
    `,
});


export async function newsAgent(input: NewsAgentInput): Promise<NewsAgentOutput> {
  const llmResponse = await agentPrompt(input);
  const toolCalls = llmResponse.toolCalls();

  let toolOutputs: any[] = [];
  if (toolCalls.length > 0) {
      toolOutputs = await Promise.all(
        toolCalls.map(async (toolCall) => {
            const tool = agentPrompt.tools[toolCall.name];
            if (!tool) throw new Error(`Unknown tool: ${toolCall.name}`);
            const output = await tool.run(toolCall.input);
            return { call: toolCall, output };
        })
      );
  } else {
    // If no tool is called, but the user is asking for news, call the news tool by default.
    const toolCall = {
        name: 'searchNews',
        input: { query: input.query },
    };
    const tool = agentPrompt.tools[toolCall.name];
    const output = await tool.run(toolCall.input);
    toolOutputs.push({ call: toolCall, output: output });
  }
  
  const finalResponse = await agentPrompt(input, { toolResponse: toolOutputs });
  
  const output = finalResponse.output();

  if (output?.articles && output.articles.length > 0 && !output.digest) {
    const digestSummary = await summarizeHeadlinesDigest(output.articles.map(a => a.headline));
    output.digest = digestSummary.digest;
  }
  
  // Ensure we always return a valid NewsAgentOutput object, even if the model fails.
  return output || { response: "I was unable to process your request." };
}
