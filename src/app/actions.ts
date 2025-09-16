'use server';

import { rankArticles } from '@/ai/flows/rank-articles-by-relevance';
import { summarizeArticle } from '@/ai/flows/summarize-article';
import { summarizeHeadline } from '@/ai/flows/summarize-headline';
import type { SummarizedArticle, Article, RankedArticle } from '@/lib/types';
import { format } from 'date-fns';

// A very basic XML parser to extract items from an RSS feed.
// This is fragile and only works for simple, standard RSS structures.
function parseRss(rssText: string, source: string): Article[] {
  const items: Article[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(rssText)) !== null) {
    const itemContent = match[1];

    const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s.exec(itemContent);
    const linkMatch = /<link>(.*?)<\/link>/s.exec(itemContent);
    const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/s.exec(itemContent);
    const sourceMatch = /<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>|<source.*?>(.*?)<\/source>/s.exec(itemContent);
    const descriptionMatch = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s.exec(itemContent);

    const headline = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : 'No title';
    const link = linkMatch ? linkMatch[1].trim() : '';
    const publicationDate = pubDateMatch ? new Date(pubDateMatch[1].trim()).toLocaleDateString() : 'No date';
    const articleSource = sourceMatch ? (sourceMatch[1] || sourceMatch[2] || '').trim() : source;
    // Attempt to get a summary, remove HTML tags. Fallback to headline.
    const summary = descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2] || '').replace(/<[^>]+>/g, '').trim() : headline;


    if (headline && link) {
      items.push({
        headline,
        summary: summary,
        link,
        source: articleSource,
        publicationDate,
      });
    }
  }
  return items;
}

// Extracts text content from HTML, focusing on the main content area.
function extractArticleContent(html: string): string {
    // Remove scripts, styles, and head for cleaner processing
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<head[^>]*>([\S\s]*?)<\/head>/gmi, '');

    // Try to find a main content container
    let mainContentHtml = '';
    const mainPatterns = [
        /<main[^>]*>([\s\S]*?)<\/main>/i,
        /<article[^>]*>([\s\S]*?)<\/article>/i,
        /<div id="content"[^>]*>([\s\S]*?)<\/div>/i,
        /<div class="post-content"[^>]*>([\s\S]*?)<\/div>/i,
        /<div class="entry-content"[^>]*>([\s\S]*?)<\/div>/i,
    ];

    for (const pattern of mainPatterns) {
        const match = cleanHtml.match(pattern);
        if (match && match[1]) {
            mainContentHtml = match[1];
            break;
        }
    }

    // If no main container is found, use the whole body content as a fallback
    if (!mainContentHtml) {
        const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        mainContentHtml = bodyMatch ? bodyMatch[1] : cleanHtml;
    }

    // Extract content from <p> tags within the main content
    const pTagRegex = /<p[^>]*>(.*?)<\/p>/g;
    let pMatch;
    const paragraphs: string[] = [];
    while ((pMatch = pTagRegex.exec(mainContentHtml)) !== null) {
        // Strip inner tags from paragraph and trim whitespace
        const paragraphText = pMatch[1].replace(/<[^>]+>/g, '').trim();
        // Only include paragraphs with meaningful content
        if (paragraphText.length > 20 && paragraphText.includes(' ')) {
            paragraphs.push(paragraphText);
        }
    }

    if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
    }

    // Fallback: strip all tags from the main content if no suitable <p> tags found
    return mainContentHtml.replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
}


export async function processFeeds(feedUrls: string[]): Promise<SummarizedArticle[]> {
  try {
    // 1. Fetch and parse all feeds
    const allArticlesPromises = feedUrls.map(async (url) => {
      try {
        const response = await fetch(url, { headers: { 'User-Agent': 'NewsFlashAggregator/1.0' } });
        if (!response.ok) {
            console.error(`Failed to fetch feed: ${url}, status: ${response.status}`);
            return [];
        }
        const rssText = await response.text();
        const urlHost = new URL(url).hostname;
        return parseRss(rssText, urlHost);
      } catch (e) {
        console.error(`Error fetching or parsing feed: ${url}`, e);
        return [];
      }
    });

    const articlesByFeed = await Promise.all(allArticlesPromises);
    let allArticles = articlesByFeed.flat();
    if (allArticles.length === 0) {
        throw new Error("No articles could be fetched from the provided RSS feeds.");
    }
    
    // Limit to 10 articles to avoid overwhelming AI services
    allArticles = allArticles.slice(0, 10);

    // 2. Rank articles based on feed-provided info and select top 1
    const rankedArticles = await rankArticles(allArticles);
    const topArticles = rankedArticles.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 1);
    
    if (topArticles.length === 0) {
        throw new Error("AI could not rank any articles.");
    }

    // 3. Perform AI summarization ONLY on the top article
    const finalArticlesPromises = topArticles.map(async (article) => {
      try {
        // Headline summary
        const headlineSummary = await summarizeHeadline({ headline: article.headline });

        // Full article summary
        const response = await fetch(article.link, { headers: { 'User-Agent': 'NewsFlashAggregator/1.0' } });
        if (!response.ok) throw new Error(`Failed to fetch article content for ${article.link}`);
        const html = await response.text();
        const articleContent = extractArticleContent(html);
        
        let fullSummary = "Could not extract sufficient article content for a summary.";
        if (articleContent.length >= 100) { // Check if content is substantial
             const articleSummary = await summarizeArticle({ articleUrl: article.link, articleContent: articleContent.substring(0, 8000) }); // Limit content size
             fullSummary = articleSummary.summary;
        }
        
        return { 
            ...article, 
            summary: headlineSummary.summary, 
            fullSummary: fullSummary 
        };

      } catch (e) {
        console.error(`Failed to summarize article content for: ${article.headline}`, e);
        const errorMessage = e instanceof Error ? e.message : "Full summary unavailable.";
        return { ...article, summary: 'Summary unavailable.', fullSummary: errorMessage };
      }
    });

    const finalArticles = await Promise.all(finalArticlesPromises);
    
    return finalArticles;

  } catch (error) {
    console.error("An error occurred in processFeeds:", error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error("Failed to process news feeds. Please check the console for more details.");
  }
}
