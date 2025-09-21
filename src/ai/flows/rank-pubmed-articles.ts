
'use server';
/**
 * @fileOverview Ranks PubMed articles by relevance for a specific persona.
 *
 * - rankPubMedArticles - A function that ranks articles for an elite athlete.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PubMedArticleSchema = z.object({
    pmid: z.string(),
    title: z.string(),
});

const RankPubMedArticlesInputSchema = z.array(PubMedArticleSchema);
export type RankPubMedArticlesInput = z.infer<typeof RankPubMedArticlesInputSchema>;

const RankedPubMedArticleSchema = z.object({
    pmid: z.string().describe("The PubMed ID of the article, returned as a STRING."),
    title: z.string().describe("The title of the article."),
});

const RankPubMedArticlesOutputSchema = z.array(RankedPubMedArticleSchema).describe('An array of the top 10 articles, ranked in order of relevance.');
export type RankPubMedArticlesOutput = z.infer<typeof RankPubMedArticlesOutputSchema>;

export async function rankPubMedArticles(input: RankPubMedArticlesInput): Promise<RankPubMedArticlesOutput> {
  return rankPubMedArticlesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'rankPubMedArticlesPrompt',
  input: { schema: z.object({ articlesAsText: z.string() }) },
  output: { schema: RankPubMedArticlesOutputSchema },
  prompt: `You are an expert sports scientist advising a young, healthy, elite athlete.
Your task is to review the following list of research articles and identify the top 10 most relevant ones for this athlete.
The athlete is interested in new research in exercise science relevant to performance, strength training, rehabilitation, and recovery.

Please rank the articles from most to least relevant based ONLY on their titles.
Your output MUST be a valid JSON array containing only the top 10 articles, in order of their ranking.

For each article in your output, return only its 'pmid' and its 'title'. The 'pmid' field MUST be a string.

For example, your output should look like this:
---
[
  { "pmid": "12345678", "title": "Example Article Title 1" },
  { "pmid": "87654321", "title": "Example Article Title 2" }
]
---

Here are the articles formatted as plain text:
---
{{{articlesAsText}}}
---
`,
});

const rankPubMedArticlesFlow = ai.defineFlow(
  {
    name: 'rankPubMedArticlesFlow',
    inputSchema: RankPubMedArticlesInputSchema,
    outputSchema: RankPubMedArticlesOutputSchema,
  },
  async (articles) => {
    // Defensive coding: Ensure all PMIDs are strings before any other processing.
    // This fixes the schema validation error where PMIDs are passed as numbers.
    const articlesWithSanitizedPmids = articles.map(article => ({
      ...article,
      pmid: String(article.pmid),
    }));

    const articlesAsText = articlesWithSanitizedPmids.map(article => 
`PMID: ${article.pmid}
Title: ${article.title}`
    ).join('\n\n---\n\n');

    const llmResponse = await prompt({ articlesAsText });
    
    const rawTextOutput = llmResponse.message?.content[0]?.text;

    if (!rawTextOutput) {
        if (llmResponse.finishReason && llmResponse.finishReason !== 'stop') {
             const errorDetails = JSON.stringify(llmResponse.custom?.candidates?.[0] || llmResponse.custom, null, 2);
             throw new Error(`The AI model failed to generate a response. Finish Reason: ${llmResponse.finishReason}.\n\n--- MODEL RESPONSE DETAILS ---\n${errorDetails}`);
        }
        const stringifiedResponse = JSON.stringify(llmResponse, null, 2);
        throw new Error(`AI call did not return any text output. This may indicate a network or API issue.\n\n--- RAW AI RESPONSE WRAPPER ---\n${stringifiedResponse}`);
    }

    let parsedOutput;
    try {
        parsedOutput = JSON.parse(rawTextOutput);
    } catch (e) {
         throw new Error(`AI returned text that was not valid JSON.\n\n--- RAW AI TEXT OUTPUT ---\n${rawTextOutput}`);
    }

    // Defensive coding: manually convert pmid to string again to fix AI output errors.
    const sanitizedOutput = parsedOutput.map((article: any) => ({
      pmid: String(article.pmid),
      title: article.title,
    }));

    try {
        // Validate the *sanitized* output
        RankPubMedArticlesOutputSchema.parse(sanitizedOutput);
    } catch (e) {
        const validationError = e instanceof Error ? e.message : 'Unknown validation error';
        throw new Error(`AI returned data in an invalid format. \n--- VALIDATION ERROR ---\n${validationError}\n\n--- RAW AI OUTPUT ---\n${JSON.stringify(parsedOutput, null, 2)}`);
    }
    
    return sanitizedOutput;
  }
);


