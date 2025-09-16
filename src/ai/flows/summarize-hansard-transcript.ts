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
    topics: z.array(z.string()).describe('A list of the main topics discussed in the debate.'),
    billsReferenced: z.array(z.string()).describe('A list of all bills referenced in the debate transcript.'),
});
export type SummarizeHansardTranscriptOutput = z.infer<typeof SummarizeHansardTranscriptOutputSchema>;

export async function summarizeHansardTranscript(input: SummarizeHansardTranscriptInput): Promise<SummarizeHansardTranscriptOutput> {
    return summarizeHansardTranscriptFlow(input);
}

const prompt = ai.definePrompt({
    name: 'summarizeHansardTranscriptPrompt',
    input: { schema: SummarizeHansardTranscriptInputSchema },
    output: { schema: SummarizeHansardTranscriptOutputSchema },
    prompt: `You are an expert parliamentary analyst. Your task is to provide a robust, accurate, and comprehensive summary of the following parliamentary debate from a Hansard transcript. The summary should be about a page long.

The transcript is provided below, with each speaker clearly tagged. Your response must include three parts:
1.  A 'summary' field: This should be a detailed, page-long summary that identifies the main bills discussed, outlines key arguments from main speakers, mentions significant events, and maintains a neutral tone, capturing the overall flow and conclusion.
2.  A 'topics' field: This should be an array of strings, where each string is a distinct topic or theme discussed during the debate.
3.  A 'billsReferenced' field: This should be an array of strings, where each string is the name or number of a specific bill mentioned in the transcript.

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
