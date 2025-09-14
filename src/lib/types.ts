export interface Article {
  headline: string;
  summary: string;
  link: string;
  source: string;
  publicationDate: string;
}

export interface RankedArticle extends Article {
  relevanceScore: number;
}

export interface SummarizedArticle extends RankedArticle {
  fullSummary: string;
}

export interface FeedCollection {
  id: string;
  name: string;
  feeds: string[];
}
