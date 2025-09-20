'use server';

import { extractArticleContent } from '@/lib/content-extractor';
import { summarizeArticles } from '@/ai/flows/summarize-articles';
import type { SummarizeArticlesInput, SummarizeArticlesOutput } from '@/ai/flows/summarize-articles';

export async function getArticleContent(articleLink: string): Promise<string> {
    try {
        console.log(`[Request Log] Fetching article content from: ${articleLink}`);
        // Some sites block requests without a user agent.
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };

        const response = await fetch(articleLink, { headers, redirect: 'follow' });

        if (!response.ok) throw new Error(`Failed to fetch article content (status: ${response.status})`);
        
        const html = await response.text();
        const content = extractArticleContent(html, articleLink);

        if (!content || content.length < 100) { // Check if content is too short
            return "Could not extract meaningful article content. The page might be a summary, video, or require JavaScript.";
        }

        return content;

    } catch (error) {
        console.error(`Error fetching article content for: ${articleLink}`, error);
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return "An unknown error occurred while fetching the article.";
    }
}

export async function summarizeArticlesInBatch(articles: SummarizeArticlesInput): Promise<SummarizeArticlesOutput> {
    try {
        const result = await summarizeArticles(articles);
        console.log("===== RAW AI OUTPUT (Server Log) =====");
        console.log("This is the raw JSON data received from the AI model.");
        console.log(JSON.stringify(result, null, 2));
        console.log("======================================");
        return result;
    } catch (error) {
        console.error('Error summarizing articles in batch:', error);
        throw new Error('Failed to get summaries from AI.');
    }
}
