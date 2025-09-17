'use server';
/**
 * @fileOverview Summarizes an entire Hansard transcript using a map-reduce approach.
 * 
 * - summarizeHansardTranscript - A function that takes a full transcript and returns a detailed summary.
 * - SummarizeHansardTranscriptInput - The input type for the function.
 * - SummarizeHansardTranscriptOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { summarizeHansardSection } from './summarize-hansard-section';

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


const summarizeHansardTranscriptFlow = ai.defineFlow(
    {
        name: 'summarizeHansardTranscriptFlow',
        inputSchema: SummarizeHansardTranscriptInputSchema,
        outputSchema: SummarizeHansardTranscriptOutputSchema,
    },
    async ({ transcript }) => {
        // 1. Split the transcript into chunks
        const chunkSize = 12000; // Approx 3000 tokens
        const chunks: string[] = [];
        for (let i = 0; i < transcript.length; i += chunkSize) {
            chunks.push(transcript.substring(i, i + chunkSize));
        }

        // 2. Summarize each chunk sequentially to avoid rate limiting (Map step)
        const sectionSummaries: { summary: string }[] = [];
        for (const chunk of chunks) {
            const summary = await summarizeHansardSection({ sectionText: chunk });
            sectionSummaries.push(summary);
        }

        // 3. Combine the summaries
        const combinedSummaries = sectionSummaries
            .map((s, i) => `Summary of Chunk ${i + 1}:\n${s.summary}`)
            .join('\n\n---\n\n');
        
        // 4. Create the final summary from the combined summaries (Reduce step)
        const { output } = await finalSummaryPrompt({ combinedSummaries });
        
        return output!;
    }
);
