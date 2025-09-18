
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
    prompt: `You are an expert legal analyst. Please provide a one-page summary of the legal developments detailed in the attached Ontario Gazette document. 
Focus specifically on the 'Ontario Regulations' section, highlighting any new or amended regulations and their key impacts. 
The summary should be concise, easy to read, and highlight the most significant changes.

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
