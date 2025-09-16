'use server';

import type { Article } from '@/lib/types';

/**
 * @fileoverview A simulated news API service.
 */

/**
 * Searches for news articles based on a query.
 * In a real application, this would call a real news API.
 * @param query The search query.
 * @returns A promise that resolves to an array of articles.
 */
export async function searchNews(query: string): Promise<Article[]> {
  console.log(`Searching for news with query: "${query}"`);

  // This is mock data. In a real application, you would fetch this from a news API.
  const allArticles: Article[] = [
    {
      headline: "Global Markets Rally on Tech Sector Growth",
      summary: "Major stock indexes around the world saw significant gains today, driven by strong performance in the technology sector.",
      link: "https://example.com/news/global-markets-rally",
      source: "News Network A",
      publicationDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
    },
    {
      headline: "Breakthrough in Renewable Energy Storage Technology",
      summary: "Scientists have announced a new battery technology that could revolutionize how we store and use renewable energy, promising a greener future.",
      link: "https://example.com/news/renewable-energy-breakthrough",
      source: "Tech Times",
      publicationDate: new Date().toISOString(),
    },
    {
        headline: "New AI Model Can Write and Debug Code",
        summary: "A new AI model has been released that can write and debug code in multiple programming languages, potentially changing the landscape of software development.",
        link: "https://example.com/news/ai-coding-model",
        source: "AI Today",
        publicationDate: new Date().toISOString(),
    },
    {
        headline: "International Space Station to Receive Upgrades",
        summary: "NASA has announced a series of upgrades for the International Space Station, aimed at extending its operational life and supporting new scientific missions.",
        link: "https://example.com/news/iss-upgrades",
        source: "Space Journal",
        publicationDate: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    },
    {
        headline: "Health Officials Urge Caution Amid New Flu Strain",
        summary: "Public health officials are advising caution as a new strain of influenza begins to circulate, recommending vaccination and hygiene measures.",
        link: "https://example.com/news/flu-strain-warning",
        source: "Global Health Org",
        publicationDate: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
    }
  ];

  // Simple filter to simulate a search.
  return allArticles.filter(article => 
    article.headline.toLowerCase().includes(query.toLowerCase()) || 
    article.summary.toLowerCase().includes(query.toLowerCase())
  );
}
