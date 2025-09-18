
'use server';
/**
 * @fileOverview Summarizes the content of the Ontario Gazette PDF.
 *
 * - summarizeOntarioGazette - A function that takes a PDF data URI and returns a summary.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeOntarioGazetteInputSchema = z.object({
    gazetteDataUri: z.string().describe("A PDF of the Ontario Gazette, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."),
});
export type SummarizeOntarioGazetteInput = z.infer<typeof SummarizeOntarioGazetteInputSchema>;

const SummarizeOntarioGazetteOutputSchema = z.object({
    summary: z.string().describe('A concise summary of the key notices and regulations in the gazette.'),
});
export type SummarizeOntarioGazetteOutput = z.infer<typeof SummarizeOntarioGazetteOutputSchema>;

export async function summarizeOntarioGazette(input: SummarizeOntarioGazetteInput): Promise<SummarizeOntarioGazetteOutput> {
    return summarizeOntarioGazetteFlow(input);
}

const prompt = ai.definePrompt({
    name: 'summarizeOntarioGazettePrompt',
    input: { schema: SummarizeOntarioGazetteInputSchema },
    output: { schema: SummarizeOntarioGazetteOutputSchema },
    model: 'googleai/gemini-1.5-flash',
    config: {
        maxOutputTokens: 4096,
    },
    prompt: `You are an expert governmental analyst specializing in Ontario provincial regulations. You have been provided with a PDF of the Ontario Gazette.
Your task is to create a clear and concise summary of the most important proposed regulations, notices, and orders.
Focus on items that have a broad impact on the public or specific industries. For each key item, briefly explain what it is about.

Here is the document:
---
{{media url=gazetteDataUri}}
---
`,
});

const summarizeOntarioGazetteFlow = ai.defineFlow(
    {
        name: 'summarizeOntarioGazetteFlow',
        inputSchema: SummarizeOntarioGazetteInputSchema,
        outputSchema: SummarizeOntarioGazetteOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        
        if (!output) {
            throw new Error("The AI model did not return any output for the Ontario gazette summary.");
        }

        return output;
    }
);
