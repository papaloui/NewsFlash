'use server';
/**
 * @fileOverview Ranks articles by relevance using AI.
 *
 * - rankArticles - A function that ranks articles based on relevance.
 * - RankArticlesInput - The input type for the rankArticles function.
 * - RankArticlesOutput - The return type for the rankArticles function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RankArticlesInputSchema = z.array(
  z.object({
    headline: z.string().describe('The headline of the article.'),
    summary: z.string().describe('A short summary of the article.'),
    link: z.string().url().describe('The URL of the article.'),
    source: z.string().describe('The source of the article.'),
    publicationDate: z.string().describe('The publication date of the article.'),
  })
).describe('An array of articles to rank.');

export type RankArticlesInput = z.infer<typeof RankArticlesInputSchema>;

const RankArticlesOutputSchema = z.array(
  z.object({
    headline: z.string().describe('The headline of the article.'),
    summary: z.string().describe('A short summary of the article.'),
    link: z.string().url().describe('The URL of the article.'),
    source: z.string().describe('The source of the article.'),
    publicationDate: z.string().describe('The publication date of the article.'),
    relevanceScore: z.number().describe('A score indicating the relevance of the article.'),
  })
).describe('An array of ranked articles with relevance scores.');

export type RankArticlesOutput = z.infer<typeof RankArticlesOutputSchema>;

export async function rankArticles(input: RankArticlesInput): Promise<RankArticlesOutput> {
  return rankArticlesFlow(input);
}

const rankArticlesPrompt = ai.definePrompt({
  name: 'rankArticlesPrompt',
  input: {schema: RankArticlesInputSchema},
  output: {schema: RankArticlesOutputSchema},
  prompt: `You are an AI assistant that ranks news articles based on their relevance.

You will be provided with an array of news articles, each with a headline, summary, link, source, and publication date.

Your task is to rank these articles based on their overall relevance and assign a relevance score to each article. The score should be a number between 0 and 1, where 1 indicates the highest relevance.

Here are the articles to rank:

{{#each this}}
Headline: {{headline}}
Summary: {{summary}}
Link: {{link}}
Source: {{source}}
Publication Date: {{publicationDate}}
{{/each}}

Return the ranked articles with their corresponding relevance scores in a JSON format.

Ensure that the output is a valid JSON array of objects, where each object represents a ranked article and includes all the original fields along with the new 'relevanceScore' field.
`,
});

const rankArticlesFlow = ai.defineFlow(
  {
    name: 'rankArticlesFlow',
    inputSchema: RankArticlesInputSchema,
    outputSchema: RankArticlesOutputSchema,
  },
  async input => {
    const {output} = await rankArticlesPrompt(input);
    return output!;
  }
);
