'use server';

import type { Article } from '@/lib/types';

/**
 * @fileoverview A service for fetching news from NewsAPI.org.
 */

interface NewsApiArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

/**
 * Searches for news articles based on a query using NewsAPI.org.
 * @param query The search query.
 * @returns A promise that resolves to an array of articles.
 */
export async function searchNews(query: string): Promise<Article[]> {
  console.log(`Searching for news with query: "${query}" using NewsAPI.org`);
  
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error('NewsAPI key is not configured. Please add NEWS_API_KEY to your .env file.');
  }

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${apiKey}&pageSize=10&sortBy=relevancy`;

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'NewsFlashAggregator/1.0' } });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('NewsAPI request failed:', errorBody);
      throw new Error(`Failed to fetch news from NewsAPI.org: ${errorBody.message || response.statusText}`);
    }

    const data: NewsApiResponse = await response.json();

    if (data.status !== 'ok') {
        throw new Error(`NewsAPI returned an error: ${data.message}`);
    }

    return data.articles.map((article: NewsApiArticle) => ({
      headline: article.title,
      summary: article.description || '',
      link: article.url,
      source: article.source.name,
      publicationDate: new Date(article.publishedAt).toLocaleDateString(),
    }));

  } catch (error) {
    console.error('Error fetching from NewsAPI:', error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('An unknown error occurred while fetching news.');
  }
}