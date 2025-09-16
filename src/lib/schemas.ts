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

export type ArticleWithSummary = SearchNewsAndRankOutput[0] & { fullSummary?: string; isSummarizing?: boolean };

export const NewsAgentInputSchema = z.object({
  query: z.string().describe('The user\'s request or question.'),
});
export type NewsAgentInput = z.infer<typeof NewsAgentInputSchema>;

export const NewsAgentOutputSchema = z.object({
    response: z.string().optional().describe('A direct textual response to the user if no articles or web results are relevant.'),
    articles: z.array(
        z.object({
            headline: z.string(),
            summary: z.string(),
            link: z.string().url(),
            source: z.string(),
            publicationDate: z.string(),
            relevanceScore: z.number(),
        })
    ).optional().describe('A list of ranked news articles, if the user asked for news.'),
    digest: z.string().optional().describe('A summary of all the headlines, if news articles were fetched.'),
});
export type NewsAgentOutput = z.infer<typeof NewsAgentOutputSchema>;
