
'use server';
/**
 * @fileOverview Summarizes a batch of bill texts in a single AI request.
 *
 * - summarizeBills - A function that takes an array of bills with their text and returns a summary.
 * - SummarizeBillsInput - The input type for the function.
 * - SummarizeBillsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BillForSummarySchema = z.object({
    billNumber: z.string().describe('The number of the bill, e.g., C-221.'),
    text: z.string().describe('The full text content of the bill. If not available, this will contain a note about its unavailability.'),
});

const SummarizeBillsInputSchema = z.array(BillForSummarySchema);
export type SummarizeBillsInput = z.infer<typeof SummarizeBillsInputSchema>;

const SummarizeBillsOutputSchema = z.object({
    summary: z.string().describe('A concise summary of all the provided bills.'),
});
export type SummarizeBillsOutput = z.infer<typeof SummarizeBillsOutputSchema>;

export async function summarizeBills(input: SummarizeBillsInput): Promise<SummarizeBillsOutput> {
    return summarizeBillsFlow(input);
}

const promptTemplate = `You are a parliamentary analyst. You will be given a JSON array of parliamentary bills from the Canadian Parliament that were updated yesterday.
For each bill, generate a concise and neutral summary. Combine these into a single, coherent report for the day.
If the text for a bill could not be retrieved, please note that in your summary for that specific bill.

Your output MUST be a single JSON object with a "summary" field containing the full report.

Input Bills:
{{jsonStringify this}}

Your JSON Output:
`;

export const summarizeBillsPrompt = ai.definePrompt({
    name: 'summarizeBillsPrompt',
    input: { schema: SummarizeBillsInputSchema },
    output: { schema: SummarizeBillsOutputSchema },
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
