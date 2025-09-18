
'use server';
/**
 * @fileOverview A conversational AI agent that can search for news and browse the web.
 *
 * - newsAgent - The main flow that orchestrates the agent's behavior.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
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

const agentPrompt = ai.definePrompt({
    name: 'newsAgentPrompt',
    input: { schema: NewsAgentInputSchema },
    output: { schema: NewsAgentOutputSchema },
    tools: [newsSearchTool, webSearchTool],
    prompt: `You are a helpful news assistant.
    
    - Your primary function is to provide users with news. If the user's query is about news (e.g., "latest on AI", "business news", "top headlines"), use the searchNews tool.
    - After fetching news, ALWAYS generate a brief, 1-2 sentence digest of the top 10 headlines.
    - If the user asks a general knowledge question (e.g., "when was X invented?"), use the searchWeb tool. Synthesize the web search results into a concise answer for the 'response' field.
    - If you use the searchNews tool, do not populate the 'response' field. The UI will display the articles.
    - If you use the searchWeb tool, populate the 'response' field with the answer and do not return any articles.
    - If the query is unclear, ask for clarification.
    
    User query: '{{{query}}}'
    `,
});

const newsAgentFlow = ai.defineFlow(
    {
        name: 'newsAgentFlow',
        inputSchema: NewsAgentInputSchema,
        outputSchema: NewsAgentOutputSchema,
    },
    async (input) => {
        const llmResponse = await agentPrompt(input);
        
        let toolOutputs: any[] = [];

        if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
            toolOutputs = await Promise.all(
                llmResponse.toolCalls.map(async (toolCall) => {
                    const tool = toolCall.name === 'searchNews' ? newsSearchTool : webSearchTool;
                    const output = await tool(toolCall.input);
                    return { call: toolCall, output };
                })
            );
        } else {
             const output = await newsSearchTool({ query: input.query });
             toolOutputs.push({ call: { name: 'searchNews', input: { query: input.query } }, output });
        }
        
        const finalResponse = await agentPrompt(input, {
            history: [
                llmResponse.request,
                llmResponse.response,
                ...toolOutputs.map(t => ({
                    role: 'tool',
                    content: [ { toolResponse: { name: t.call.name, output: t.output } } ]
                }))
            ]
        });

        const output = finalResponse.output;

        if (output?.articles && output.articles.length > 0) {
            const headlines = output.articles.slice(0, 10).map(a => ({ headline: a.headline, body: a.summary }));
            if (headlines.length > 0) {
                const digestSummary = await summarizeHeadlinesDigest(headlines);
                output.digest = digestSummary.digest;
            }
        }

        return output || { response: "I was unable to process your request." };
    }
);

export async function newsAgent(input: NewsAgentInput): Promise<NewsAgentOutput> {
    return newsAgentFlow(input);
}
