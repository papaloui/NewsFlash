
'use server';

import { extractArticleContent } from '@/lib/content-extractor';

export async function getArticleContent(articleLink: string): Promise<string> {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };

        const response = await fetch(articleLink, { headers });

        if (!response.ok) throw new Error(`Failed to fetch article content (status: ${response.status})`);
        
        const html = await response.text();
        const content = extractArticleContent(html, articleLink);

        if (content.length === 0) {
            return "Could not extract any article content. The page might be empty or require JavaScript.";
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
