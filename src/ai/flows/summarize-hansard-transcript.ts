'use server';
/**
 * @fileOverview Summarizes an entire Hansard transcript.
 * 
 * - summarizeHansardTranscript - A function that takes a full transcript and returns a detailed summary.
 * - SummarizeHansardTranscriptInput - The input type for the function.
 * - SummarizeHansardTranscriptOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeHansardTranscriptInputSchema = z.object({
    transcript: z.string().describe('The full text content of a Hansard debate, with speakers tagged.'),
});
export type SummarizeHansardTranscriptInput = z.infer<typeof SummarizeHansardTranscriptInputSchema>;

const SummarizeHansardTranscriptOutputSchema = z.object({
    summary: z.string().describe('A detailed, page-long summary of the provided Hansard transcript.'),
});
export type SummarizeHansardTranscriptOutput = z.infer<typeof SummarizeHansardTranscriptOutputSchema>;

export async function summarizeHansardTranscript(input: SummarizeHansardTranscriptInput): Promise<SummarizeHansardTranscriptOutput> {
    return summarizeHansardTranscriptFlow(input);
}

const prompt = ai.definePrompt({
    name: 'summarizeHansardTranscriptPrompt',
    input: { schema: SummarizeHansardTranscriptInputSchema },
    output: { schema: SummarizeHansardTranscriptOutputSchema },
    config: {
        model: 'googleai/gemini-2.5-flash',
        maxOutputTokens: 2048,
    },
    prompt: `You are an expert parliamentary analyst. Your task is to provide a robust, accurate, and comprehensive summary of the following parliamentary debate from a Hansard transcript. The summary should be about a page long.

The transcript is provided below, with each speaker clearly tagged. Your summary should:
- Identify the main topics and bills discussed.
- Outline the key arguments presented by the main speakers and parties.
- Mention any significant votes, motions, or procedural events.
- Maintain a neutral, objective tone.
- Capture the overall flow and conclusion of the debates.

Debate Transcript:
{{{transcript}}}
`,
});

const summarizeHansardTranscriptFlow = ai.defineFlow(
    {
        name: 'summarizeHansardTranscriptFlow',
        inputSchema: SummarizeHansardTranscriptInputSchema,
        outputSchema: SummarizeHansardTranscriptOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
