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
