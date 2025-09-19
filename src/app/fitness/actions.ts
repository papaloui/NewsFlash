
'use server';

export interface PubMedArticle {
    title: string;
    authors: string[];
    journal: string;
    publication_date: string;
    abstract: string;
    pmid: string;
    fullTextUrl?: string;
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
