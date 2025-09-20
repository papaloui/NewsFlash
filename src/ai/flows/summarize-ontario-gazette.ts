
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
    prompt: `You are an expert legal analyst writing a professional briefing. Your goal is to produce a cohesive, narrative-style summary of the attached Ontario Gazette. The summary should read as a single, well-structured report, not a choppy list of points.

Your primary focus must be on the 'Ontario Regulations' section. Synthesize the information to:
1.  Identify new or amended regulations.
2.  Explain their key impacts and practical consequences.
3.  Group related items together to create a smooth, logical flow in your writing.

The final output should be a concise, easy-to-read, one-page report highlighting the most significant legal changes.

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

