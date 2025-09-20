'use server';

/**
 * @fileOverview Summarizes news headlines using AI to provide a quick understanding of the article topic.
 *
 * - summarizeHeadline - A function that summarizes a news headline.
 * - SummarizeHeadlineInput - The input type for the summarizeHeadline function.
 * - SummarizeHeadlineOutput - The return type for the summarizeHeadline function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeHeadlineInputSchema = z.object({
  headline: z.string().describe('The news headline to summarize.'),
});
export type SummarizeHeadlineInput = z.infer<typeof SummarizeHeadlineInputSchema>;

const SummarizeHeadlineOutputSchema = z.object({
  summary: z.string().describe('A 1-2 sentence summary of the news headline.'),
});
export type SummarizeHeadlineOutput = z.infer<typeof SummarizeHeadlineOutputSchema>;

export async function summarizeHeadline(input: SummarizeHeadlineInput): Promise<SummarizeHeadlineOutput> {
  return summarizeHeadlineFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeHeadlinePrompt',
  input: {schema: SummarizeHeadlineInputSchema},
  output: {schema: SummarizeHeadlineOutputSchema},
  prompt: `Summarize the following news headline in 1-2 sentences:\n\n{{{headline}}}`,
});

const summarizeHeadlineFlow = ai.defineFlow(
  {
    name: 'summarizeHeadlineFlow',
    inputSchema: SummarizeHeadlineInputSchema,
    outputSchema: SummarizeHeadlineOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
