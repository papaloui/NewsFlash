'use server';
/**
 * @fileOverview Creates a daily digest from a list of headlines.
 *
 * - summarizeHeadlinesDigest - A function that takes a list of headlines and returns a digest.
 * - SummarizeHeadlinesDigestInput - The input type for the summarizeHeadlinesDigest function.
 * - SummarizeHeadlinesDigestOutput - The return type for the summarizeHeadlinesDigest function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeHeadlinesDigestInputSchema = z.array(z.string()).describe("An array of news headlines.");
export type SummarizeHeadlinesDigestInput = z.infer<typeof SummarizeHeadlinesDigestInputSchema>;

const SummarizeHeadlinesDigestOutputSchema = z.object({
  digest: z.string().describe('A brief, 1-2 sentence summary of all the provided headlines, like a daily digest.'),
});
export type SummarizeHeadlinesDigestOutput = z.infer<typeof SummarizeHeadlinesDigestOutputSchema>;

export async function summarizeHeadlinesDigest(input: SummarizeHeadlinesDigestInput): Promise<SummarizeHeadlinesDigestOutput> {
  return summarizeHeadlinesDigestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeHeadlinesDigestPrompt',
  input: {schema: SummarizeHeadlinesDigestInputSchema},
  output: {schema: SummarizeHeadlinesDigestOutputSchema},
  prompt: `You are a news editor. Your task is to create a very brief daily digest (1-2 sentences) from the following list of headlines. Capture the main themes of the day's news.\n\nHeadlines:\n{{#each this}}- {{{.}}}\n{{/each}}`,
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
