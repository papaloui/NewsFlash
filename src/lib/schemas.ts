
import { z } from 'zod';

// This file is now mostly unused but kept for future AI feature re-integration.

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

export const TranscriptChunkSchema = z.object({
    speaker: z.string(),
    text: z.string(),
});
export type TranscriptChunk = z.infer<typeof TranscriptChunkSchema>;

export const SummarizeHansardTranscriptInputSchema = z.array(TranscriptChunkSchema);
export type SummarizeHansardTranscriptInput = z.infer<typeof SummarizeHansardTranscriptInputSchema>;

const DebugInfoSchema = z.object({
    chunkSummaries: z.array(z.string()).describe('An array of summaries for each chunk.'),
    finalPrompt: z.string().describe('The final combined prompt sent to the model.'),
});

export const SummarizeHansardTranscriptOutputSchema = z.object({
    summary: z.string().describe('A detailed, page-long summary of the provided Hansard transcript.'),
    topics: z.array(z.string()).describe('A list of the main topics discussed in the debate.'),
    billsReferenced: z.array(z.string()).describe('A list of all bills referenced in the debate transcript.'),
    debugInfo: DebugInfoSchema.optional(),
});
export type SummarizeHansardTranscriptOutput = z.infer<typeof SummarizeHansardTranscriptOutputSchema>;

// The ArticleWithSummary type from previous work is no longer relevant for this flow.
// We will use the types from lib/types.ts
