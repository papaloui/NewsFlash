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
    description: 'Search for recent news articles. Use this for queries about current events, top headlines, or specific news topics.',
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

const agentTools = {
    [newsSearchTool.name]: newsSearchTool,
    [webSearchTool.name]: webSearchTool,
};


const agentPrompt = ai.definePrompt({
    name: 'newsAgentPrompt',
    input: { schema: NewsAgentInputSchema },
    output: { schema: NewsAgentOutputSchema },
    tools: [newsSearchTool, webSearchTool],
    prompt: `You are a helpful news assistant.
    
    - Your primary function is to provide users with news. If the user's query is about news (e.g., "latest on AI", "business news", "top headlines"), use the searchNews tool.
    - After fetching news, ALWAYS generate a brief, 1-2 sentence digest of all the headlines combined.
    - When searching for news, you must rank the articles by relevance to the user's query and set the relevanceScore for each article. A score of 1 is most relevant.
    - If the user asks a general knowledge question (e.g., "when was X invented?"), use the searchWeb tool. Synthesize the web search results into a concise answer for the 'response' field.
    - If you use the searchNews tool, do not populate the 'response' field. The UI will display the articles.
    - If you use the searchWeb tool, populate the 'response' field with the answer and do not return any articles.
    - If the query is unclear, ask for clarification.
    
    User query: '{{{query}}}'
    `,
});


export async function newsAgent(input: NewsAgentInput): Promise<NewsAgentOutput> {
  const llmResponse = await agentPrompt(input);
  let toolOutputs: any[] = [];
  
  // If the model wants to call a tool, let it.
  if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      toolOutputs = await Promise.all(
        llmResponse.toolCalls.map(async (toolCall) => {
            const tool = agentTools[toolCall.name];
            if (!tool) throw new Error(`Unknown tool: ${toolCall.name}`);
            const output = await tool.run(toolCall.input);
            return { call: toolCall, output };
        })
      );
  } else {
    // If no tool is called, but the user is likely asking for news, call the news tool by default.
    // This handles simple queries like "AI news" or the initial "top headlines" load.
     const tool = agentTools.searchNews;
     const output = await tool.run({ query: input.query });
     toolOutputs.push({ call: { name: 'searchNews', input: { query: input.query } }, output });
  }
  
  const finalResponse = await agentPrompt(input, { toolResponse: toolOutputs });
  
  const output = finalResponse.output;

  if (output?.articles && output.articles.length > 0 && !output.digest) {
    const headlines = output.articles.map(a => a.headline);
    if(headlines.length > 0) {
      const digestSummary = await summarizeHeadlinesDigest(headlines);
      output.digest = digestSummary.digest;
    }
  }
  
  // Ensure we always return a valid NewsAgentOutput object, even if the model fails.
  return output || { response: "I was unable to process your request." };
}
