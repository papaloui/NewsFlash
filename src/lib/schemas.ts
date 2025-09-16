import { z } from 'zod';

export const SearchNewsAndRankInputSchema = z.object({
  query: z.string().describe('The search query for news articles.'),
});
export type SearchNewsAndRankInput = z.infer<typeof SearchNewsAndRankInputSchema>;

export const SearchNewsAndRankOutputSchema = z.array(
  z.object({
    headline: z.string().describe('The headline of the article.'),
    summary: z.string().describe('A short summary of the article.'),
    link: z.string().url().describe('The URL of the article.'),
    source: z.string().describe('The source of the article.'),
    publicationDate: z.string().describe('The publication date of the article.'),
    relevanceScore: z.number().describe('A score from 0 to 1 indicating the relevance of the article to the user query.'),
  })
).describe('An array of ranked articles with relevance scores.');
export type SearchNewsAndRankOutput = z.infer<typeof SearchNewsAndRankOutputSchema>;
