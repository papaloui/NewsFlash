'use server';
/**
 * @fileOverview Summarizes a batch of PubMed articles in a single AI request.
 *
 * - summarizePubMedArticles - A function that takes an array of articles and returns summaries for each.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PubMedArticleForSummarySchema = z.object({
    pmid: z.string().describe('The unique PubMed ID of the article.'),
    title: z.string().describe('The title of the article.'),
});

const SummarizePubMedArticlesInputSchema = z.array(PubMedArticleForSummarySchema);
export type SummarizePubMedArticlesInput = z.infer<typeof SummarizePubMedArticlesInputSchema>;

const ArticleSummarySchema = z.object({
    pmid: z.string().describe('The original PubMed ID to map the summary back to the article.'),
    summary: z.string().describe('A concise, 1-2 sentence summary of the article abstract, written for a layperson to understand.'),
});

const SummarizePubMedArticlesOutputSchema = z.array(ArticleSummarySchema);
export type SummarizePubMedArticlesOutput = z.infer<typeof SummarizePubMedArticlesOutputSchema>;


export async function summarizePubMedArticles(input: SummarizePubMedArticlesInput): Promise<SummarizePubMedArticlesOutput> {
    return summarizePubMedArticlesFlow(input);
}

const promptTemplate = `You are an expert science communicator. You will be given a JSON array of medical research articles.
For each article, read the abstract and generate a concise and easy-to-understand 1-2 sentence summary for a general audience. Avoid jargon.
Your output MUST be a valid JSON array, where each object contains the original "pmid" and the generated "summary". Do not include any other text or explanation outside of the JSON array itself.

Input Articles:
{{jsonStringify this}}

Your JSON Output:
`;

export const summarizePubMedArticlesPrompt = ai.definePrompt({
    name: 'summarizePubMedArticlesPrompt',
    input: { schema: SummarizePubMedArticlesInputSchema },
    output: { schema: SummarizePubMedArticlesOutputSchema },
    prompt: promptTemplate,
});

const summarizePubMedArticlesFlow = ai.defineFlow(
    {
        name: 'summarizePubMedArticlesFlow',
        inputSchema: SummarizePubMedArticlesInputSchema,
        outputSchema: SummarizePubMedArticlesOutputSchema,
    },
    async (input) => {
        const { output } = await summarizePubMedArticlesPrompt(input);
        
        if (!output) {
            throw new Error("The AI model did not return any output. The response was empty.");
        }

        return output;
    }
);