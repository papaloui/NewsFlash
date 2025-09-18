
'use server';
/**
 * @fileOverview Summarizes a Hansard transcript using a Map-Reduce strategy to handle large texts.
 * 
 * - summarizeHansardTranscript - A function that takes a full transcript and returns a detailed summary.
 * - SummarizeHansardTranscriptInput - The input type for the function.
 * - SummarizeHansardTranscriptOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { SummarizeHansardTranscriptInput, SummarizeHansardTranscriptOutput } from '@/lib/schemas';
import { SummarizeHansardTranscriptInputSchema, SummarizeHansardTranscriptOutputSchema } from '@/lib/schemas';
import { logDebug } from '@/lib/logger';

const summaryPromptTemplate = `You are an expert parliamentary analyst. You have been provided with a chunk of a parliamentary debate transcript. Your task is to summarize this chunk accurately.

Here is the chunk of the debate:
---
{{{chunk}}}
---

Please provide a concise summary of this chunk.`;

const finalSummaryPromptTemplate = `You are an expert parliamentary analyst. You have been provided with a series of summaries from a parliamentary debate. Your task is to synthesize these into a single, robust, accurate, and comprehensive final summary that is about a page long.

Your response must include three parts:
1.  A 'summary' field: This should be a detailed, page-long summary that identifies the main bills discussed, outlines key arguments from main speakers, mentions significant events, and maintains a neutral tone, capturing the overall flow and conclusion.
2.  A 'topics' field: This should be an array of strings, where each string is a distinct topic or theme discussed during the debate.
3.  A 'billsReferenced' field: This should be an array of strings, where each string is the name or number of a specific bill mentioned in the source summaries.

Here are the summaries of the debate chunks:
---
{{#each summaries}}
- {{{this}}}
{{/each}}
---
`;

const chunkSummaryPrompt = ai.definePrompt({
    name: 'summarizeHansardChunkPrompt',
    input: { schema: z.object({ chunk: z.string() }) },
    output: { schema: z.object({ summary: z.string() }) },
    prompt: summaryPromptTemplate,
});

const finalSummaryPrompt = ai.definePrompt({
    name: 'combineHansardSummariesPrompt',
    input: { schema: z.object({ summaries: z.array(z.string()) }) },
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
    async (chunks) => {
        logDebug(`Starting summarizeHansardTranscriptFlow with ${chunks.length} transcript chunks.`);

        // 1. Map: Summarize each chunk individually
        const chunkSummariesPromises = chunks.map(async (chunk, index) => {
            logDebug(`Summarizing chunk ${index + 1}/${chunks.length}`);
            const { output } = await chunkSummaryPrompt({ chunk: `${chunk.speaker}: ${chunk.text}` });
            return output?.summary || `Could not summarize chunk ${index + 1}.`;
        });
        
        const chunkSummaries = await Promise.all(chunkSummariesPromises);
        logDebug('All chunks have been summarized.');

        // 2. Reduce: Combine the chunk summaries into a final summary
        logDebug('Starting final reduction step to create a single summary.');
        const { output: finalOutput } = await finalSummaryPrompt({ summaries: chunkSummaries });
        
        if (!finalOutput) {
            throw new Error('The final summarization step failed to produce an output.');
        }

        logDebug('Final summary received from AI.');
        
        return {
            ...finalOutput,
            debugInfo: {
                chunkSummaries: chunkSummaries,
                finalPrompt: finalSummaryPromptTemplate.replace('{{#each summaries}}...{{/each}}', chunkSummaries.join('\n- ')),
            },
        };
    }
);
