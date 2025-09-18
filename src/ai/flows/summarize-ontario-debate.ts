
'use server';
/**
 * @fileOverview Summarizes the content of an Ontario Legislative Assembly debate PDF.
 *
 * - summarizeOntarioDebate - A function that takes a PDF data URI and returns a summary.
 * - SummarizeOntarioDebateInput - The input type for the function.
 * - SummarizeOntarioDebateOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeOntarioDebateInputSchema = z.object({
    debateDataUri: z.string().describe("A PDF of the Ontario Hansard, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."),
});
export type SummarizeOntarioDebateInput = z.infer<typeof SummarizeOntarioDebateInputSchema>;

const SummarizeOntarioDebateOutputSchema = z.object({
    summary: z.string().describe('A concise summary of the key debates, discussions, and decisions in the transcript.'),
});
export type SummarizeOntarioDebateOutput = z.infer<typeof SummarizeOntarioDebateOutputSchema>;

export async function summarizeOntarioDebate(input: SummarizeOntarioDebateInput): Promise<SummarizeOntarioDebateOutput> {
    return summarizeOntarioDebateFlow(input);
}

const prompt = ai.definePrompt({
    name: 'summarizeOntarioDebatePrompt',
    input: { schema: SummarizeOntarioDebateInputSchema },
    output: { schema: SummarizeOntarioDebateOutputSchema },
    model: 'googleai/gemini-1.5-flash',
    config: {
        maxOutputTokens: 4096,
    },
    prompt: `You are an expert parliamentary analyst for the Legislative Assembly of Ontario. You have been provided with a PDF of a Hansard debate transcript.
Your task is to create a clear and concise summary of the most important debates, discussions, and decisions.
Focus on items that have a broad impact on the public or specific industries. For each key item, briefly explain what it is about and the key arguments presented.

Here is the document:
---
{{media url=debateDataUri}}
---
`,
});

const summarizeOntarioDebateFlow = ai.defineFlow(
    {
        name: 'summarizeOntarioDebateFlow',
        inputSchema: SummarizeOntarioDebateInputSchema,
        outputSchema: SummarizeOntarioDebateOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        
        if (!output) {
            throw new Error("The AI model did not return any output for the debate summary.");
        }

        return output;
    }
);
