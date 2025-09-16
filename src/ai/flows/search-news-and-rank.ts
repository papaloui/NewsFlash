'use server';
/**
 * @fileOverview A flow that searches for news articles using a tool and then ranks them.
 *
 * - searchNewsAndRank - A function that takes a query, searches for news, and ranks the results.
 * - SearchNewsAndRankInput - The input type for the searchNewsAndRank function.
 * - SearchNewsAndRankOutput - The return type for the searchNewsAndRank function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { searchNews as searchNewsService } from '@/services/news-api';
import type { Article } from '@/lib/types';

// Define a tool for searching news
const searchNewsTool = ai.defineTool(
    {
        name: 'searchNews',
        description: 'Search for news articles on a given topic.',
        inputSchema: z.object({ query: z.string().describe('The topic to search for.') }),
        outputSchema: z.array(
            z.object({
                headline: z.string(),
                summary: z.string(),
                link: z.string().url(),
                source: z.string(),
                publicationDate: z.string(),
            })
        ),
    },
    async ({ query }) => {
        return await searchNewsService(query);
    }
);

export const SearchNewsAndRankInputSchema = z.object({
  query: z.string().describe('The search query for news articles.'),
});
export type SearchNewsAndRankInput = z.infer<typeof SearchNewsAndRankInputSchema>;

export const SearchNewsAndRankOutputSchema = z.array(
  z.object({
    headline: z.string().describe('The headline of the article.'),
    summary: z.string().describe('A short summary of the article.'),
    link: z.string().url().describe('The URL of the article.'),
    source: z.string().describe('The source of the article.'),
    publicationDate: z.string().describe('The publication date of the article.'),
    relevanceScore: z.number().describe('A score from 0 to 1 indicating the relevance of the article to the user query.'),
  })
).describe('An array of ranked articles with relevance scores.');

export type SearchNewsAndRankOutput = z.infer<typeof SearchNewsAndRankOutputSchema>;


export async function searchNewsAndRank(input: SearchNewsAndRankInput): Promise<SearchNewsAndRankOutput> {
    return searchNewsAndRankFlow(input);
}


const searchAndRankPrompt = ai.definePrompt({
    name: 'searchAndRankPrompt',
    input: { schema: SearchNewsAndRankInputSchema },
    output: { schema: SearchNewsAndRankOutputSchema },
    tools: [searchNewsTool],
    prompt: `You are a news analyst. A user wants to find relevant news about '{{{query}}}'.
    
    1. First, use the searchNews tool to find articles related to the user's query.
    2. Then, analyze the search results and rank them based on their relevance to the query.
    3. Assign a relevanceScore to each article from 0 (not relevant) to 1 (highly relevant).
    4. Return the ranked list of articles. Do not invent articles, only use the ones from the tool.
    `,
});


const searchNewsAndRankFlow = ai.defineFlow(
    {
        name: 'searchNewsAndRankFlow',
        inputSchema: SearchNewsAndRankInputSchema,
        outputSchema: SearchNewsAndRankOutputSchema,
    },
    async (input) => {
        const { output } = await searchAndRankPrompt(input);
        return output || [];
    }
);
