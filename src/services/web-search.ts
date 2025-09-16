'use server';

/**
 * @fileoverview A placeholder service for performing web searches.
 */

export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * A placeholder function that simulates a web search.
 * In a real application, this would call a search engine API like Google Search.
 * @param query The search query.
 * @returns A promise that resolves to an array of search results.
 */
export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  console.log(`Simulating web search for: "${query}"`);

  // This is placeholder data. A real implementation would fetch from a search API.
  const mockResults: Record<string, WebSearchResult[]> = {
    "when were the tariffs first instituted by the US": [
      {
        title: "Tariff Act of 1789 - Wikipedia",
        link: "https://en.wikipedia.org/wiki/Tariff_Act_of_1789",
        snippet: "The Tariff Act of 1789 was the first major piece of legislation passed by the new United States government. It was signed into law by President George Washington on July 4, 1789. The act imposed tariffs on imported goods to raise revenue for the federal government and protect domestic industries.",
      },
      {
        title: "Milestones: 1784–1800 - Office of the Historian",
        link: "https://history.state.gov/milestones/1784-1800/treaty-of-paris",
        snippet: "Following the Revolutionary War, the young nation faced significant economic challenges, leading to the enactment of tariffs to manage debt and fund the government.",
      },
    ],
    "default": [
        {
            title: "No results found",
            link: "#",
            snippet: "This is a placeholder search. No results for your query."
        }
    ]
  };
  
  const results = Object.keys(mockResults).find(k => query.toLowerCase().includes(k.toLowerCase())) 
    ? mockResults[query] 
    : mockResults["default"];

  return Promise.resolve(results || mockResults['default']);
}
