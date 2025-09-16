'use server';
/**
 * @fileOverview A conversational AI agent for querying Hansard transcripts.
 * 
 * - hansardAgent - A function that answers questions based on a transcript and summary.
 * - HansardAgentInput - The input type for the function.
 * - HansardAgentOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const HansardAgentInputSchema = z.object({
    transcript: z.string().describe('The full text content of a Hansard debate, with speakers tagged.'),
    summary: z.string().describe('A summary of the transcript.'),
    query: z.string().describe('The user\'s question about the transcript.'),
});
export type HansardAgentInput = z.infer<typeof HansardAgentInputSchema>;

const HansardAgentOutputSchema = z.object({
    response: z.string().describe('The AI\'s answer to the user\'s question.'),
});
export type HansardAgentOutput = z.infer<typeof HansardAgentOutputSchema>;

export async function hansardAgent(input: HansardAgentInput): Promise<HansardAgentOutput> {
    return hansardAgentFlow(input);
}

const prompt = ai.definePrompt({
    name: 'hansardAgentPrompt',
    input: { schema: HansardAgentInputSchema },
    output: { schema: HansardAgentOutputSchema },
    prompt: `You are an expert parliamentary assistant. You have been provided with a full transcript of a parliamentary debate and a summary of it. Your task is to answer the user's question based *only* on the information contained in these documents. Do not use any external knowledge.

If the answer cannot be found in the provided transcript or summary, state that you cannot answer the question with the given information.

Here is the summary of the debate:
---
{{{summary}}}
---

Here is the full transcript:
---
{{{transcript}}}
---

User's Question: "{{{query}}}"
`,
});

const hansardAgentFlow = ai.defineFlow(
    {
        name: 'hansardAgentFlow',
        inputSchema: HansardAgentInputSchema,
        outputSchema: HansardAgentOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        return output!;
    }
);
