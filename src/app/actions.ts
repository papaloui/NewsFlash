'use server';

import { rankArticles } from '@/ai/flows/rank-articles-by-relevance';
import { summarizeArticle } from '@/ai/flows/summarize-article';
import { summarizeHeadline } from '@/ai/flows/summarize-headline';
import type { SummarizedArticle, Article } from '@/lib/types';

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

    const headline = titleMatch ? (titleMatch[1] || titleMatch[2]).trim() : 'No title';
    const link = linkMatch ? linkMatch[1].trim() : '';
    const publicationDate = pubDateMatch ? new Date(pubDateMatch[1].trim()).toLocaleDateString() : 'No date';
    const articleSource = sourceMatch ? (sourceMatch[1] || sourceMatch[2]).trim() : source;

    if (headline && link) {
      items.push({
        headline,
        summary: '', // Will be filled by AI
        link,
        source: articleSource,
        publicationDate,
      });
    }
  }
  return items;
}

// Extracts text content from HTML, focusing on <p> tags.
function extractArticleContent(html: string): string {
    // Remove scripts, styles, and head
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<head[^>]*>([\S\s]*?)<\/head>/gmi, '');

    // Extract content from <p> tags
    const pTagRegex = /<p[^>]*>(.*?)<\/p>/g;
    let match;
    const paragraphs: string[] = [];
    while ((match = pTagRegex.exec(cleanHtml)) !== null) {
        // Strip inner tags from paragraph
        const paragraphText = match[1].replace(/<[^>]+>/g, '');
        if (paragraphText.trim().length > 0) {
            paragraphs.push(paragraphText.trim());
        }
    }

    if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
    }

    // Fallback: strip all tags if no <p> tags found
    return html.replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
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
    
    // Limit to 50 articles to avoid overwhelming AI services
    allArticles = allArticles.slice(0, 50);

    // 2. Headline Summarization for each article
    const articlesWithHeadlineSummariesPromises = allArticles.map(async (article) => {
      try {
        const headlineSummary = await summarizeHeadline({ headline: article.headline });
        return { ...article, summary: headlineSummary.summary };
      } catch (e) {
        console.error(`Failed to summarize headline for: ${article.headline}`, e);
        return { ...article, summary: 'Summary unavailable.' };
      }
    });

    const articlesWithHeadlineSummaries = await Promise.all(articlesWithHeadlineSummariesPromises);

    // 3. Rank articles and select top 3
    const rankedArticles = await rankArticles(articlesWithHeadlineSummaries);
    const top3Articles = rankedArticles.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
    
    if (top3Articles.length === 0) {
        throw new Error("AI could not rank any articles.");
    }

    // 4. Fetch article content and get full summary for top 3
    const finalArticlesPromises = top3Articles.map(async (article) => {
      try {
        const response = await fetch(article.link, { headers: { 'User-Agent': 'NewsFlashAggregator/1.0' } });
        if (!response.ok) throw new Error(`Failed to fetch article content for ${article.link}`);
        const html = await response.text();
        const articleContent = extractArticleContent(html);
        
        if (articleContent.length < 100) { // Check if content is substantial
             return { ...article, fullSummary: "Could not extract sufficient article content for a summary." };
        }
        
        const articleSummary = await summarizeArticle({ articleUrl: article.link, articleContent: articleContent.substring(0, 8000) }); // Limit content size for AI
        return { ...article, fullSummary: articleSummary.summary };

      } catch (e) {
        console.error(`Failed to summarize article content for: ${article.headline}`, e);
        return { ...article, fullSummary: 'Full summary unavailable.' };
      }
    });

    const finalArticles = await Promise.all(finalArticlesPromises);
    
    return finalArticles;

  } catch (error) {
    console.error("An error occurred in processFeeds:", error);
    throw new Error("Failed to process news feeds. Please check the console for more details.");
  }
}
