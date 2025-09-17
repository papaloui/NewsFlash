
'use server';
/**
 * @fileOverview Summarizes an entire Hansard transcript using a single request to a large-context model.
 * 
 * - summarizeHansardTranscript - A function that takes a full transcript and returns a detailed summary.
 * - SummarizeHansardTranscriptInput - The input type for the function.
 * - SummarizeHansardTranscriptOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { SummarizeHansardTranscriptOutput } from '@/lib/schemas';
import { SummarizeHansardTranscriptOutputSchema } from '@/lib/schemas';
import { logDebug } from '@/lib/logger';

const SummarizeHansardTranscriptInputSchema = z.object({
    transcript: z.string().describe('The full text content of a Hansard debate, with speakers tagged.'),
});
export type SummarizeHansardTranscriptInput = z.infer<typeof SummarizeHansardTranscriptInputSchema>;


export async function summarizeHansardTranscript(input: SummarizeHansardTranscriptInput): Promise<SummarizeHansardTranscriptOutput> {
    return summarizeHansardTranscriptFlow(input);
}

const summaryPrompt = ai.definePrompt({
    name: 'summarizeHansardTranscriptPrompt',
    input: { schema: SummarizeHansardTranscriptInputSchema },
    output: { schema: SummarizeHansardTranscriptOutputSchema },
    config: {
        maxOutputTokens: 8192, // Allow for a long, detailed summary
    },
    prompt: `You are an expert parliamentary analyst. You have been provided with the full transcript of a parliamentary debate. Your task is to synthesize this into a single, robust, accurate, and comprehensive summary. The final summary should be about a page long.

Your response must include three parts:
1.  A 'summary' field: This should be a detailed, page-long summary that identifies the main bills discussed, outlines key arguments from main speakers, mentions significant events, and maintains a neutral tone, capturing the overall flow and conclusion.
2.  A 'topics' field: This should be an array of strings, where each string is a distinct topic or theme discussed during the debate.
3.  A 'billsReferenced' field: This should be an array of strings, where each string is the name or number of a specific bill mentioned in the transcript.

Here is the full transcript of the debate:
---
{{{transcript}}}
---
`,
});

const summarizeHansardTranscriptFlow = ai.defineFlow(
    {
        name: 'summarizeHansardTranscriptFlow',
        inputSchema: SummarizeHansardTranscriptInputSchema,
        outputSchema: SummarizeHansardTranscriptOutputSchema,
    },
    async (input) => {
        logDebug(`Starting summarizeHansardTranscriptFlow with a single transcript of length: ${input.transcript.length}`);
        
        const { output } = await summaryPrompt(input);
        
        logDebug('Final summary received from AI.');
        
        return {
            ...output!,
            debugInfo: {
                chunkSummaries: [`Transcript length: ${input.transcript.length}`],
                finalPrompt: `(Prompt sent to AI):\n\n${summaryPrompt.prompt.substring(0, 500)}...[TRUNCATED]...\n\n(Transcript passed as input):\n\n${input.transcript}`,
            },
        };
    }
);
