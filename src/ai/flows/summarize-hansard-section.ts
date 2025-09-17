'use server';
/**
 * @fileOverview Summarizes a section of a Hansard transcript.
 * 
 * - summarizeHansardSection - A function that takes text from a Hansard section and returns a summary.
 * - SummarizeHansardSectionInput - The input type for the function.
 * - SummarizeHansardSectionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeHansardSectionInputSchema = z.object({
    sectionText: z.string().describe('The full text content of a Hansard debate section.'),
});
export type SummarizeHansardSectionInput = z.infer<typeof SummarizeHansardSectionInputSchema>;

const SummarizeHansardSectionOutputSchema = z.object({
    summary: z.string().describe('A concise summary of the provided Hansard section.'),
});
export type SummarizeHansardSectionOutput = z.infer<typeof SummarizeHansardSectionOutputSchema>;

export async function summarizeHansardSection(input: SummarizeHansardSectionInput): Promise<SummarizeHansardSectionOutput> {
    return summarizeHansardSectionFlow(input);
}

const prompt = ai.definePrompt({
    name: 'summarizeHansardSectionPrompt',
    input: { schema: SummarizeHansardSectionInputSchema },
    output: { schema: SummarizeHansardSectionOutputSchema },
    config: {
        maxOutputTokens: 1024,
    },
    prompt: `You are an expert parliamentary assistant. Your task is to summarize a section of a parliamentary debate from the Hansard transcript.

The user will provide the text of a section. Identify the key speakers, the main topics discussed, and any motions or votes that occurred. Provide a concise, neutral summary.

Section Text:
{{{sectionText}}}
`,
});

const summarizeHansardSectionFlow = ai.defineFlow(
    {
        name: 'summarizeHansardSectionFlow',
        inputSchema: SummarizeHansardSectionInputSchema,
        outputSchema: SummarizeHansardSectionOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
