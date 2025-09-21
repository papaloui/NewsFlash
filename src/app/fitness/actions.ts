
'use server';

import { rankPubMedArticles, type RankPubMedArticlesInput } from "@/ai/flows/rank-pubmed-articles";
import { XMLParser } from "fast-xml-parser";

export interface PubMedArticle {
    title: string;
    authors: string[];
    journal: string;
    publication_date: string;
    abstract: string;
    pmid: string; 
    doi?: string;
    fullTextUrl?: string;
}

const get = (obj: any, path: string, defaultValue: any = null) => {
    const value = path.split('.').reduce((acc, c) => (acc && acc[c]) ? acc[c] : undefined, obj);
    return value === undefined ? defaultValue : value;
};

const extractText = (field: any): string => {
    if (typeof field === 'string') {
        return field;
    }
    if (typeof field === 'object' && field !== null && field['#text']) {
        return field['#text'];
    }
    if (Array.isArray(field)) {
        return field.map(extractText).join('');
    }
    if (typeof field === 'object' && field !== null) {
        return Object.values(field).flat().map(extractText).join('');
    }
    return 'No title available';
};

const extractAbstract = (abstractNode: any): string => {
    if (!abstractNode) return 'No abstract available.';
    
    if (typeof abstractNode === 'string') return abstractNode;
    if (abstractNode['#text']) return abstractNode['#text'];
    
    const abstractTexts = abstractNode.AbstractText;
    if (!abstractTexts) return 'No abstract available.';

    if (typeof abstractTexts === 'string') return abstractTexts;
    
    if (Array.isArray(abstractTexts)) {
        return abstractTexts.map(part => {
            if (typeof part === 'string') return part;
            if (typeof part === 'object' && part !== null) {
                const label = part['@_Label'] ? `${part['@_Label']}: ` : '';
                const text = part['#text'] || '';
                return `${label}${text}`;
            }
            return '';
        }).join('\n');
    }
    return 'No abstract available.';
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getAndRankPubMedArticles(): Promise<{ articles?: PubMedArticle[], error?: string }> {
    const searchTerm = "strength training OR cardiac rehab OR exercise recovery OR cardiovascular exercise";
    const retmax = 50; 

    try {
        const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${retmax}&sort=pub+date&reldate=60&retmode=json`;
        console.log(`[PubMed] Fetching PMIDs from: ${esearchUrl}`);
        
        const esearchResponse = await fetch(esearchUrl);
        if (!esearchResponse.ok) {
            throw new Error(`Failed to fetch from ESearch: ${esearchResponse.statusText}`);
        }
        const esearchData = await esearchResponse.json();
        const pmidList = get(esearchData, 'esearchresult.idlist', []);

        if (!pmidList || pmidList.length === 0) return { articles: [] };
        
        const pmidString = pmidList.join(',');
        await sleep(200);

        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmidString}&retmode=xml`;
        console.log(`[PubMed] Fetching article data from: ${efetchUrl}`);
        const efetchResponse = await fetch(efetchUrl);
        if (!efetchResponse.ok) {
            throw new Error(`Failed to fetch from EFetch: ${efetchResponse.statusText}`);
        }
        const xmlText = await efetchResponse.text();
        
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            parseTagValue: true,
            trimValues: true,
            textNodeName: "#text",
            isArray: (name) => ['PubmedArticle', 'Author', 'AbstractText', 'ArticleId'].includes(name)
        });
        const parsedXml = parser.parse(xmlText);
        const articlesFromXml = get(parsedXml, 'PubmedArticleSet.PubmedArticle', []);
        
        const allArticlesMap = new Map<string, PubMedArticle>();
        
        articlesFromXml.forEach((article: any) => {
            const articleData = get(article, 'MedlineCitation.Article');
            // Ensure PMID is a string at the source.
            const pmid = String(get(article, 'MedlineCitation.PMID.#text'));

            if (!pmid) return;

            const title = extractText(get(articleData, 'ArticleTitle', 'No title available'));
            const authors = get(articleData, 'AuthorList.Author', []).map((author: any) => `${get(author, 'ForeName', '')} ${get(author, 'LastName', '')}`.trim()).filter(Boolean);
            const journal = get(articleData, 'Journal.Title', 'N/A');
            
            const pubDate = get(articleData, 'Journal.JournalIssue.PubDate');
            const publication_date = [get(pubDate, 'Year', ''), get(pubDate, 'Month', ''), get(pubDate, 'Day', '')].filter(Boolean).join('-');
            const abstract = extractAbstract(get(articleData, 'Abstract'));

            const doiObject = get(article, 'PubmedData.ArticleIdList.ArticleId', []).find((id: any) => id['@_IdType'] === 'doi');
            const doi = doiObject ? doiObject['#text'] : undefined;
            const fullTextUrl = doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

            allArticlesMap.set(pmid, { title, authors, journal, publication_date, abstract, pmid, doi, fullTextUrl });
        });

        const articlesForRanking: RankPubMedArticlesInput = Array.from(allArticlesMap.values()).map(article => ({
            pmid: article.pmid,
            title: article.title,
        }));
        
        if (articlesForRanking.length === 0) return { articles: [] };

        const rankedArticleIdentifiers = await rankPubMedArticles(articlesForRanking);
        
        const finalRankedArticles: PubMedArticle[] = rankedArticleIdentifiers.map(ranked => {
            return allArticlesMap.get(ranked.pmid)!;
        }).filter(Boolean);

        return { articles: finalRankedArticles };

    } catch (error) {
        let errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getAndRankPubMedArticles:', error);
        return { error: errorMessage };
    }
}
