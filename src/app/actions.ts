'use server';

import { summarizeArticle } from '@/ai/flows/summarize-article';
import { extractArticleContent } from '@/lib/content-extractor';


export async function getArticleSummary(articleUrl: string, articleLink: string): Promise<string> {
    try {
        // Using a more browser-like User-Agent to avoid being blocked.
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };

        const response = await fetch(articleLink, { headers });

        if (!response.ok) throw new Error(`Failed to fetch article content for ${articleLink} (status: ${response.status})`);
        
        const html = await response.text();
        const articleContent = extractArticleContent(html, articleLink);

        if (articleContent.length < 100) {
            console.warn(`Extracted content for ${articleLink} was too short (${articleContent.length} chars). Summary may be poor.`);
            if (articleContent.length === 0) {
                return "Could not extract any article content. The page might be empty or require JavaScript.";
            }
        }

        // Limit content sent to AI to avoid exceeding token limits for long articles.
        const contentForSummary = articleContent.substring(0, 12000);

        const articleSummary = await summarizeArticle({ articleUrl: articleUrl, articleContent: contentForSummary });
        return articleSummary.summary;

    } catch (error) {
        console.error(`Error summarizing article: ${articleUrl}`, error);
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return "An unknown error occurred while summarizing the article.";
    }
}
