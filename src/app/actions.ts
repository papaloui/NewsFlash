'use server';

import { summarizeArticle } from '@/ai/flows/summarize-article';
import { extractArticleContent } from '@/lib/content-extractor';


export async function getArticleSummary(articleUrl: string, articleLink: string): Promise<string> {
    try {
        const response = await fetch(articleLink, { headers: { 'User-Agent': 'NewsFlashAggregator/1.0' } });
        if (!response.ok) throw new Error(`Failed to fetch article content for ${articleLink}`);
        const html = await response.text();
        const articleContent = extractArticleContent(html);

        if (articleContent.length < 100) {
            return "Could not extract sufficient article content for a summary.";
        }

        const articleSummary = await summarizeArticle({ articleUrl: articleUrl, articleContent: articleContent.substring(0, 8000) });
        return articleSummary.summary;

    } catch (error) {
        console.error(`Error summarizing article: ${articleUrl}`, error);
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return "An unknown error occurred while summarizing the article.";
    }
}
