
'use server';
/**
 * @fileOverview Summarizes the full text of a single article.
 *
 * - summarizeFullArticleText - A function that takes article text and returns a summary.
 * - SummarizeFullArticleTextInput - The input type for the function.
 * - SummarizeFullArticleTextOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeFullArticleTextInputSchema = z.object({
    articleText: z.string().describe('The full text content of the article to be summarized.'),
});
export type SummarizeFullArticleTextInput = z.infer<typeof SummarizeFullArticleTextInputSchema>;

const SummarizeFullArticleTextOutputSchema = z.object({
    summary: z.string().describe('A concise, paragraph-long summary of the article.'),
});
export type SummarizeFullArticleTextOutput = z.infer<typeof SummarizeFullArticleTextOutputSchema>;


export async function summarizeFullArticleText(input: SummarizeFullArticleTextInput): Promise<SummarizeFullArticleTextOutput> {
    return summarizeArticleFlow(input);
}

const promptTemplate = `You are an expert science communicator. You will be given the full text of a research article.
Your task is to generate a concise and easy-to-understand summary for a general audience. The summary should be a single, well-structured paragraph. Avoid jargon where possible.

Article Text:
---
{{{articleText}}}
---

Your JSON Output:
`;

const summarizeArticlePrompt = ai.definePrompt({
    name: 'summarizeFullArticlePrompt',
    input: { schema: SummarizeFullArticleTextInputSchema },
    output: { schema: SummarizeFullArticleTextOutputSchema },
    prompt: promptTemplate,
});

const summarizeArticleFlow = ai.defineFlow(
    {
        name: 'summarizeArticleFlow',
        inputSchema: SummarizeFullArticleTextInputSchema,
        outputSchema: SummarizeFullArticleTextOutputSchema,
    },
    async (input) => {
        const { output } = await summarizeArticlePrompt(input);
        
        if (!output) {
            throw new Error("The AI model did not return any output. The response was empty.");
        }

        return output;
    }
);
