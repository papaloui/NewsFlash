
'use server';

import { summarizePubMedArticles } from '@/ai/flows/summarize-pubmed-articles';
import type { SummarizePubMedArticlesInput, SummarizePubMedArticlesOutput } from '@/ai/flows/summarize-pubmed-articles';

export interface PubMedArticle {
    title: string;
    authors: string[];
    journal: string;
    publication_date: string;
    abstract: string;
    pmid: string;
}

export async function getPubMedArticles(): Promise<{ articles?: PubMedArticle[], error?: string }> {
    try {
        // We need the full URL for server-side fetch
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
        const res = await fetch(`${baseUrl}/api/pubmed`);

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Failed to fetch PubMed articles. Status: ${res.status}`);
        }
        const articles = await res.json();
        return { articles };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getPubMedArticles:', error);
        return { error: errorMessage };
    }
}

export async function summarizeArticlesInBatches(articles: PubMedArticle[]): Promise<SummarizePubMedArticlesOutput> {
     try {
        const articlesToSummarize: SummarizePubMedArticlesInput = articles.map(a => ({
            pmid: a.pmid,
            title: a.title,
            abstract: a.abstract,
        }));
        
        const result = await summarizePubMedArticles(articlesToSummarize);
        console.log("===== RAW AI OUTPUT (Server Log) =====");
        console.log(JSON.stringify(result, null, 2));
        console.log("======================================");
        return result;
    } catch (error) {
        console.error('Error summarizing pubmed articles in batch:', error);
        throw new Error('Failed to get summaries from AI.');
    }
}
