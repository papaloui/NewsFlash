import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

// Extracts text content from HTML using Mozilla's Readability library.
export function extractArticleContent(html: string, url?: string): string {
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    // 'article' can be null if Readability fails to parse the document
    if (article && article.textContent) {
        // The textContent property contains the extracted article text
        return article.textContent.trim();
    }
    
    // Fallback: if Readability fails, strip all tags from the body as a last resort.
    // This is less accurate but better than returning nothing.
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const fallbackHtml = bodyMatch ? bodyMatch[1] : html;
    
    return fallbackHtml.replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
}
