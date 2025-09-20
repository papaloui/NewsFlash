
'use server';
/**
 * @fileOverview Summarizes a Hansard transcript using a single prompt.
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
  transcript: z.string().describe('The full, complete text of the Hansard debate transcript.'),
});
export type SummarizeHansardTranscriptInput = z.infer<typeof SummarizeHansardTranscriptInputSchema>;

const finalSummaryPromptTemplate = `You are an expert parliamentary analyst. You have been provided with the full transcript of a parliamentary debate. Your task is to synthesize this into a single, robust, accurate, and comprehensive final summary that is about a page long.

Your response must include three parts:
1.  A 'summary' field: This should be a detailed, page-long summary that identifies the main bills discussed, outlines key arguments from main speakers, mentions significant events, and maintains a neutral tone, capturing the overall flow and conclusion.
2.  A 'topics' field: This should be an array of strings, where each string is a distinct topic or theme discussed during the debate.
3.  A 'billsReferenced' field: This should be an array of strings, where each string is the name or number of a specific bill mentioned in the source transcript.

Here is the full transcript:
---
{{{transcript}}}
---
`;

const finalSummaryPrompt = ai.definePrompt({
    name: 'summarizeHansardTranscriptPrompt',
    input: { schema: SummarizeHansardTranscriptInputSchema },
    output: { schema: SummarizeHansardTranscriptOutputSchema },
    config: {
        maxOutputTokens: 8192, // Allow for a long, detailed summary
    },
    prompt: finalSummaryPromptTemplate,
});

export async function summarizeHansardTranscript(input: SummarizeHansardTranscriptInput): Promise<SummarizeHansardTranscriptOutput> {
    return summarizeHansardTranscriptFlow(input);
}

const summarizeHansardTranscriptFlow = ai.defineFlow(
    {
        name: 'summarizeHansardTranscriptFlow',
        inputSchema: SummarizeHansardTranscriptInputSchema,
        outputSchema: SummarizeHansardTranscriptOutputSchema,
    },
    async (input) => {
        logDebug(`Starting summarizeHansardTranscriptFlow with a single large transcript.`);

        const { output: finalOutput } = await finalSummaryPrompt(input);
        
        if (!finalOutput) {
            throw new Error('The final summarization step failed to produce an output.');
        }

        logDebug('Final summary received from AI.');
        
        return {
            ...finalOutput,
            debugInfo: {
                // For a single prompt, there are no chunk summaries. The final prompt is the whole thing.
                chunkSummaries: ['This was a single-prompt summarization. No intermediate chunks were used.'],
                finalPrompt: finalSummaryPromptTemplate.replace('{{{transcript}}}', input.transcript),
            },
        };
    }
);
