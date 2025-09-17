
'use server';
/**
 * @fileOverview Summarizes an entire Hansard transcript using a map-reduce approach with semantic chunking.
 * 
 * - summarizeHansardTranscript - A function that takes a full transcript and returns a detailed summary.
 * - SummarizeHansardTranscriptInput - The input type for the function.
 * - SummarizeHansardTranscriptOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { summarizeHansardSection } from './summarize-hansard-section';


export const TranscriptChunkSchema = z.object({
    speaker: z.string(),
    text: z.string(),
});
export type TranscriptChunk = z.infer<typeof TranscriptChunkSchema>;

const SummarizeHansardTranscriptInputSchema = z.array(TranscriptChunkSchema);
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

const finalSummaryPrompt = ai.definePrompt({
    name: 'summarizeHansardTranscriptPrompt',
    input: { schema: z.object({ combinedSummaries: z.string() }) },
    output: { schema: SummarizeHansardTranscriptOutputSchema },
    prompt: `You are an expert parliamentary analyst. You have been provided with a series of summaries from different sections of a parliamentary debate. Your task is to synthesize these into a single, robust, accurate, and comprehensive summary of the entire debate. The final summary should be about a page long.

Your response must include three parts:
1.  A 'summary' field: This should be a detailed, page-long summary that identifies the main bills discussed, outlines key arguments from main speakers, mentions significant events, and maintains a neutral tone, capturing the overall flow and conclusion.
2.  A 'topics' field: This should be an array of strings, where each string is a distinct topic or theme discussed during the debate, based on the provided summaries.
3.  A 'billsReferenced' field: This should be an array of strings, where each string is the name or number of a specific bill mentioned in the transcript summaries.

Here are the summaries of the debate sections:
---
{{{combinedSummaries}}}
---
`,
});

// Helper function to recursively summarize text, breaking it down if it's too long.
async function summarizeRecursively(text: string, speaker: string, chunkSize: number): Promise<string> {
    if (text.length <= chunkSize) {
        const result = await summarizeHansardSection({ sectionText: `${speaker}: ${text}` });
        return result.summary;
    }

    // Text is too long, split it and summarize each part recursively.
    const subChunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        subChunks.push(text.substring(i, i + chunkSize));
    }

    const subSummaries: string[] = [];
    for (const subChunk of subChunks) {
        // Recursive call
        const subSummary = await summarizeRecursively(subChunk, speaker, chunkSize);
        subSummaries.push(subSummary);
    }

    // Combine the summaries of the sub-chunks into a single summary for the original long text.
    const combinedSubSummaries = subSummaries.join('\n\n');
    const finalSubSummary = await summarizeHansardSection({ sectionText: `The following are summaries of a long speech by ${speaker}. Please combine them into a single, coherent summary of the entire speech:\n\n${combinedSubSummaries}` });
    
    return finalSubSummary.summary;
}

const summarizeHansardTranscriptFlow = ai.defineFlow(
    {
        name: 'summarizeHansardTranscriptFlow',
        inputSchema: SummarizeHansardTranscriptInputSchema,
        outputSchema: SummarizeHansardTranscriptOutputSchema,
    },
    async (transcriptChunks) => {
        const chunkSize = 12000; // Approx 3000 tokens, a safe limit for a single section summarization call.
        const sectionSummaries: string[] = [];

        // 1. Summarize each intervention, breaking down long ones (Map step)
        for (const chunk of transcriptChunks) {
            const summary = await summarizeRecursively(chunk.text, chunk.speaker, chunkSize);
            sectionSummaries.push(`${chunk.speaker}:\n${summary}`);
        }

        // 2. Combine the individual summaries
        const combinedSummaries = sectionSummaries.join('\n\n---\n\n');
        
        // 3. Create the final summary from the combined summaries (Reduce step)
        const { output } = await finalSummaryPrompt({ combinedSummaries });
        
        return output!;
    }
);
