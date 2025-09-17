
export interface Article {
  headline: string;
  summary: string; // Original summary from RSS feed
  link: string;
  source: string;
  publicationDate: string;
}

export interface RankedArticle extends Article {
  relevanceScore: number;
}

export interface FeedCollection {
  id: string;
  name: string;
  feeds: string[];
}
