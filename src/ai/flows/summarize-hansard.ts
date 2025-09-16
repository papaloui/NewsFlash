'use server';
/**
 * @fileOverview A flow to summarize a long transcript from the House of Commons.
 *
 * - summarizeHansard - A function that takes a long transcript, chunks it, and summarizes it.
 * - SummarizeHansardInput - The input type for the summarizeHansard function.
 * - SummarizeHansardOutput - The return type for the summarizeHansard function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeHansardInputSchema = z.object({
  transcript: z.string().describe('The full text transcript of the Hansard.'),
});
export type SummarizeHansardInput = z.infer<typeof SummarizeHansardInputSchema>;

const SummarizeHansardOutputSchema = z.object({
  summary: z.string().describe('A comprehensive summary of the key topics, decisions, and notable quotes from the transcript.'),
});
export type SummarizeHansardOutput = z.infer<typeof SummarizeHansardOutputSchema>;


const summarizationPrompt = ai.definePrompt({
    name: 'hansardChunkSummarizer',
    input: { schema: z.object({ chunk: z.string() }) },
    output: { schema: z.object({ chunkSummary: z.string() }) },
    prompt: `Summarize the following Hansard transcript chunk. Focus on the key topics, debates, and decisions. Extract any notable quotes.
    
    Transcript Chunk:
    {{{chunk}}}
    `,
});

const finalSummaryPrompt = ai.definePrompt({
    name: 'hansardFinalSummarizer',
    input: { schema: z.object({ chunkSummaries: z.array(z.string()) }) },
    output: { schema: SummarizeHansardOutputSchema },
    prompt: `You are a political analyst. The following are summaries of sequential chunks of a Canadian House of Commons sitting. Your task is to synthesize them into a single, coherent, and comprehensive daily digest. Structure your summary with clear headings for major topics.
    
    Chunk Summaries:
    {{#each chunkSummaries}}
    - {{{this}}}
    {{/each}}
    `,
});


function chunkTranscript(transcript: string, chunkSize = 8000): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < transcript.length; i += chunkSize) {
        chunks.push(transcript.substring(i, i + chunkSize));
    }
    return chunks;
}


export async function summarizeHansard(input: SummarizeHansardInput): Promise<SummarizeHansardOutput> {
    const transcriptChunks = chunkTranscript(input.transcript);

    // Step 1: Summarize each chunk in parallel
    const chunkSummaries = await Promise.all(
        transcriptChunks.map(async (chunk) => {
            const { output } = await summarizationPrompt({ chunk });
            return output?.chunkSummary || '';
        })
    );

    const filteredSummaries = chunkSummaries.filter(summary => summary.trim() !== '');

    if(filteredSummaries.length === 0) {
        return { summary: "Could not generate a summary from the provided transcript." };
    }

    // Step 2: Create a final summary from the chunk summaries
    const finalResponse = await finalSummaryPrompt({ chunkSummaries: filteredSummaries });
    
    return finalResponse.output || { summary: "Failed to produce a final summary." };
}
