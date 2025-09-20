'use server';
/**
 * @fileOverview Creates a daily digest from a list of articles.
 *
 * - summarizeHeadlinesDigest - A function that takes a list of articles and returns a digest.
 * - SummarizeHeadlinesDigestInput - The input type for the summarizeHeadlinesDigest function.
 * - SummarizeHeadlinesDigestOutput - The return type for the summarizeHeadlinesDigest function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeHeadlinesDigestInputSchema = z.array(z.object({
  headline: z.string().describe("The headline of the article."),
  body: z.string().describe("The full text content of the article."),
})).describe("An array of news articles with their full content.");
export type SummarizeHeadlinesDigestInput = z.infer<typeof SummarizeHeadlinesDigestInputSchema>;

const SummarizeHeadlinesDigestOutputSchema = z.object({
  digest: z.string().describe('A comprehensive, page-long summary of all the provided articles.'),
});
export type SummarizeHeadlinesDigestOutput = z.infer<typeof SummarizeHeadlinesDigestOutputSchema>;

export async function summarizeHeadlinesDigest(input: SummarizeHeadlinesDigestInput): Promise<SummarizeHeadlinesDigestOutput> {
  return summarizeHeadlinesDigestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeHeadlinesDigestPrompt',
  input: {schema: SummarizeHeadlinesDigestInputSchema},
  output: {schema: SummarizeHeadlinesDigestOutputSchema},
  prompt: `You are an expert news analyst. Your task is to create a single, high-quality, and comprehensive summary from the following list of news articles. The summary should be about a page long and accurately synthesize the key information, themes, and connections between the articles.

Here are the articles:
{{#each this}}
---
Headline: {{{headline}}}
Article Content:
{{{body}}}
---
{{/each}}
`,
});

const summarizeHeadlinesDigestFlow = ai.defineFlow(
  {
    name: 'summarizeHeadlinesDigestFlow',
    inputSchema: SummarizeHeadlinesDigestInputSchema,
    outputSchema: SummarizeHeadlinesDigestOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
