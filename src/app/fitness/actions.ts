
'use server';

import { rankPubMedArticles, type RankPubMedArticlesInput } from "@/ai/flows/rank-pubmed-articles";
import { extractArticleContent } from "@/lib/content-extractor";

export interface PubMedArticle {
    title: string;
    authors: string[];
    journal: string;
    publication_date: string;
    abstract: string;
    pmid: string; // Ensure pmid is consistently a string
    doi?: string;
    fullTextUrl?: string;
}

const get = (obj: any, path: string, defaultValue: any = null) => {
    const value = path.split('.').reduce((acc, c) => (acc && acc[c]) ? acc[c] : undefined, obj);
    return value === undefined ? defaultValue : value;
};

const extractText = (field: any): string => {
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && field !== null && field['#text']) return field['#text'];
    if (Array.isArray(field)) return field.map(extractText).join('');
    if (typeof field === 'object' && field !== null) return Object.values(field).flat().map(extractText).join('');
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
    const searchTerm = "strength training OR exercise recovery OR sports performance OR athlete";
    const retmax = 50; 

    try {
        const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${retmax}&sort=pub+date&reldate=7&retmode=json`;
        console.log(`[PubMed] Fetching PMIDs from: ${esearchUrl}`);
        const esearchResponse = await fetch(esearchUrl);
        if (!esearchResponse.ok) throw new Error(`Failed ESearch: ${esearchResponse.statusText}`);

        const esearchText = await esearchResponse.text();
        if (esearchText.trim().startsWith('<')) {
            throw new Error(`PubMed ESearch returned an unexpected XML response instead of JSON. This may be an API error. Content: ${esearchText.slice(0, 200)}`);
        }
        const esearchData = JSON.parse(esearchText);

        const pmidList = get(esearchData, 'esearchresult.idlist', []);
        if (!pmidList || pmidList.length === 0) return { articles: [] };

        const pmidString = pmidList.join(',');
        await sleep(200);

        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmidString}&retmode=xml`;
        console.log(`[PubMed] Fetching article data from: ${efetchUrl}`);
        const efetchResponse = await fetch(efetchUrl);
        if (!efetchResponse.ok) throw new Error(`Failed EFetch: ${efetchResponse.statusText}`);
        const xmlText = await efetchResponse.text();
        await sleep(200);
        
        const { XMLParser } = await import("fast-xml-parser");
        const parser = new XMLParser({
            ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: true,
            trimValues: true, textNodeName: "#text",
            isArray: (name) => ['PubmedArticle', 'Author', 'AbstractText', 'ArticleId'].includes(name)
        });
        const parsedXml = parser.parse(xmlText);
        const articlesFromXml = get(parsedXml, 'PubmedArticleSet.PubmedArticle', []);
        
        const allArticlesMap = new Map<string, PubMedArticle>();
        
        articlesFromXml.forEach((article: any) => {
            const articleData = get(article, 'MedlineCitation.Article');
            // Ensure PMID is a string from the very beginning.
            const pmidValue = get(article, 'MedlineCitation.PMID.#text');
            if (!pmidValue) return; // Skip if no PMID
            const pmid = String(pmidValue);

            const title = extractText(get(articleData, 'ArticleTitle', 'No title available'));
            const authorsList = get(articleData, 'AuthorList.Author', []).map((a: any) => `${get(a, 'ForeName', '')} ${get(a, 'LastName', '')}`.trim()).filter(Boolean);
            const authors = authorsList;
            const journal = get(articleData, 'Journal.Title', 'N/A');
            const pubDate = get(articleData, 'Journal.JournalIssue.PubDate');
            const publication_date = [get(pubDate, 'Year', ''), get(pubDate, 'Month', ''), get(pubDate, 'Day', '')].filter(Boolean).join('-');
            const abstract = extractAbstract(get(articleData, 'Abstract'));
            const doiObject = get(article, 'PubmedData.ArticleIdList.ArticleId', []).find((id: any) => id['@_IdType'] === 'doi');
            const doi = doiObject ? doiObject['#text'] : undefined;
            
            let fullTextUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
            if (doi) fullTextUrl = `https://doi.org/${doi}`;
            
            const articleObject: PubMedArticle = { title, authors, journal, publication_date, abstract, pmid, doi, fullTextUrl };

            if (articleObject.title !== 'No title available') {
                 allArticlesMap.set(pmid, articleObject);
            }
        });

        const articlesForRanking: RankPubMedArticlesInput = Array.from(allArticlesMap.values()).map(article => ({
            pmid: article.pmid,
            title: article.title,
        }));
        
        if(articlesForRanking.length === 0) {
            return { articles: [] };
        }

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
