'use server';
/**
 * @fileOverview Summarizes a batch of articles in a single AI request.
 *
 * - summarizeArticles - A function that takes an array of articles and returns summaries for each.
 * - SummarizeArticlesInput - The input type for the function.
 * - SummarizeArticlesOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ArticleForSummarySchema = z.object({
    link: z.string().url().describe('The unique URL of the article.'),
    source: z.string().describe('The news source or publication name.'),
    headline: z.string().describe('The headline of the article.'),
    publicationDate: z.string().describe('The date the article was published.'),
    body: z.string().describe('The full text content of the article.'),
});

const SummarizeArticlesInputSchema = z.array(ArticleForSummarySchema);
export type SummarizeArticlesInput = z.infer<typeof SummarizeArticlesInputSchema>;

const ArticleSummarySchema = z.object({
    link: z.string().url().describe('The original URL of the article to map it back.'),
    summary: z.string().describe('A concise, 1-2 sentence summary of the article.'),
});

const SummarizeArticlesOutputSchema = z.array(ArticleSummarySchema);
export type SummarizeArticlesOutput = z.infer<typeof SummarizeArticlesOutputSchema>;


export async function summarizeArticles(input: SummarizeArticlesInput): Promise<SummarizeArticlesOutput> {
    return summarizeArticlesFlow(input);
}

const promptTemplate = `You are a news summarization expert. You will be given a JSON array of news articles.
For each article, generate a concise and neutral 1-2 sentence summary.
Your output MUST be a valid JSON array, where each object contains the original "link" and the generated "summary".

Input Articles:
{{{json input}}}

Your JSON Output:
`;

export const summarizeArticlesPrompt = ai.definePrompt({
    name: 'summarizeArticlesPrompt',
    input: { schema: SummarizeArticlesInputSchema },
    output: { schema: SummarizeArticlesOutputSchema },
    prompt: promptTemplate,
});

const summarizeArticlesFlow = ai.defineFlow(
    {
        name: 'summarizeArticlesFlow',
        inputSchema: SummarizeArticlesInputSchema,
        outputSchema: SummarizeArticlesOutputSchema,
    },
    async (input) => {
        const { output } = await summarizeArticlesPrompt(input);
        return output || [];
    }
);
