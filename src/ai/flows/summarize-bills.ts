
'use server';
/**
 * @fileOverview Summarizes a batch of bill texts in a single AI request.
 *
 * - summarizeBills - A function that takes a string of bill texts and returns a summary.
 * - SummarizeBillsInput - The input type for the function.
 * - SummarizeBillsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeBillsInputSchema = z.object({
    billsText: z.string().describe('A single string containing the full text of one or more parliamentary bills, separated by headers.'),
});
export type SummarizeBillsInput = z.infer<typeof SummarizeBillsInputSchema>;

const SummarizeBillsOutputSchema = z.object({
    summary: z.string().describe('A concise summary of all the provided bills.'),
});
export type SummarizeBillsOutput = z.infer<typeof SummarizeBillsOutputSchema>;

export async function summarizeBills(input: SummarizeBillsInput): Promise<SummarizeBillsOutput> {
    return summarizeBillsFlow(input);
}

const promptTemplate = `You are a parliamentary analyst. You have been provided with the full text of one or more parliamentary bills from the Canadian Parliament.
Your task is to create a single, coherent report summarizing all of them.
For each bill, generate a concise and neutral summary. Combine these into the final report.
If the text for a bill could not be retrieved, a note will indicate this. Please mention this in your summary for that specific bill.

Here is the full text of the bills:
---
{{{billsText}}}
---

Your JSON Output:
`;

const summarizeBillsPrompt = ai.definePrompt({
    name: 'summarizeBillsPrompt',
    input: { schema: SummarizeBillsInputSchema },
    output: { schema: SummarizeBillsOutputSchema },
    config: {
        model: 'googleai/gemini-1.5-flash-preview',
        maxOutputTokens: 8192,
    },
    prompt: promptTemplate,
});

const summarizeBillsFlow = ai.defineFlow(
    {
        name: 'summarizeBillsFlow',
        inputSchema: SummarizeBillsInputSchema,
        outputSchema: SummarizeBillsOutputSchema,
    },
    async (input) => {
        const { output } = await summarizeBillsPrompt(input);
        
        if (!output) {
            throw new Error("The AI model did not return any output. The response was empty.");
        }

        return output;
    }
);
