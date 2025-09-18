
'use server';
/**
 * @fileOverview Summarizes the content of the Canada Gazette.
 *
 * - summarizeGazette - A function that takes text content and returns a summary.
 * - SummarizeGazetteInput - The input type for the function.
 * - SummarizeGazetteOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeGazetteInputSchema = z.object({
    gazetteText: z.string().describe('The full text content of the Canada Gazette PDF.'),
});
export type SummarizeGazetteInput = z.infer<typeof SummarizeGazetteInputSchema>;

const SummarizeGazetteOutputSchema = z.object({
    summary: z.string().describe('A concise summary of the key notices and regulations in the gazette.'),
});
export type SummarizeGazetteOutput = z.infer<typeof SummarizeGazetteOutputSchema>;

export async function summarizeGazette(input: SummarizeGazetteInput): Promise<SummarizeGazetteOutput> {
    return summarizeGazetteFlow(input);
}

const prompt = ai.definePrompt({
    name: 'summarizeGazettePrompt',
    input: { schema: SummarizeGazetteInputSchema },
    output: { schema: SummarizeGazetteOutputSchema },
    config: {
        model: 'googleai/gemini-1.5-flash',
        maxOutputTokens: 4096,
    },
    prompt: `You are an expert governmental analyst. You have been provided with the full text of Part I of the Canada Gazette.
Your task is to create a clear and concise summary of the most important proposed regulations, notices, and orders.
Focus on items that have a broad impact on the public or specific industries. For each key item, briefly explain what it is about.

Here is the full text:
---
{{{gazetteText}}}
---
`,
});

const summarizeGazetteFlow = ai.defineFlow(
    {
        name: 'summarizeGazetteFlow',
        inputSchema: SummarizeGazetteInputSchema,
        outputSchema: SummarizeGazetteOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        
        if (!output) {
            throw new Error("The AI model did not return any output for the gazette summary.");
        }

        return output;
    }
);
