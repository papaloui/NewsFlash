
'use server';

import { rankPubMedArticles, type RankPubMedArticlesInput } from "@/ai/flows/rank-pubmed-articles";
import { summarizePubMedArticles } from "@/ai/flows/summarize-pubmed-articles";
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
        // This handles cases where the title has formatting like <i> or <sub>
        return Object.values(field).flat().map(extractText).join('');
    }
    return 'No title available';
};

const extractAbstract = (abstractNode: any): string => {
    if (!abstractNode) return 'No abstract available.';
    
    // Case 1: Abstract is a simple string
    if (typeof abstractNode === 'string') {
        return abstractNode;
    }

    // Case 2: Abstract is an object with a text node
    if (abstractNode['#text']) {
        return abstractNode['#text'];
    }
    
    // Case 3: Abstract is an object with AbstractText
    const abstractTexts = abstractNode.AbstractText;
    if (!abstractTexts) return 'No abstract available.';

    // If AbstractText is a string
    if (typeof abstractTexts === 'string') {
        return abstractTexts;
    }
    
    // If AbstractText is an array of strings or objects
    if (Array.isArray(abstractTexts)) {
        return abstractTexts.map(part => {
            if (typeof part === 'string') {
                return part;
            }
            if (typeof part === 'object' && part !== null) {
                // For structured abstracts like { '@_Label': 'CONCLUSION', '#text': '...' }
                const label = part['@_Label'] ? `${part['@_Label']}: ` : '';
                const text = part['#text'] || '';
                return `${label}${text}`;
            }
            return '';
        }).join('\n');
    }

    // Fallback for any other unexpected structure
    return 'No abstract available.';
}


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getAndRankPubMedArticles(): Promise<{ articles?: PubMedArticle[], error?: string }> {
    const searchTerm = "strength training OR cardiac rehab OR exercise recovery OR cardiovascular exercise";
    const retmax = 50; 

    try {
        // Step 1: ESearch to get recent PMIDs
        const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${retmax}&sort=pub+date&reldate=60&retmode=json`;
        console.log(`[PubMed] Fetching PMIDs from: ${esearchUrl}`);
        
        const esearchResponse = await fetch(esearchUrl);
        if (!esearchResponse.ok) {
            throw new Error(`Failed to fetch from ESearch: ${esearchResponse.statusText}`);
        }
        const esearchData = await esearchResponse.json();
        const pmidList = get(esearchData, 'esearchresult.idlist', []);

        if (!pmidList || pmidList.length === 0) {
            return { articles: [] };
        }
        const pmidString = pmidList.join(',');

        await sleep(200); // Polite delay

        // Step 2: EFetch for metadata
        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmidString}&retmode=xml`;
        console.log(`[PubMed] Fetching article data from: ${efetchUrl}`);
        const efetchResponse = await fetch(efetchUrl);
        if (!efetchResponse.ok) {
            throw new Error(`Failed to fetch from EFetch: ${efetchResponse.statusText}`);
        }
        const xmlText = await efetchResponse.text();
        
        await sleep(200); // Polite delay

        // Step 3: Parse XML
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            parseTagValue: true,
            trimValues: true,
            textNodeName: "#text",
            isArray: (name, jpath, isLeafNode, isAttribute) => {
                 const arrayPaths = new Set(['PubmedArticle', 'Author', 'AbstractText', 'ArticleId']);
                 return arrayPaths.has(name);
            }
        });
        const parsedXml = parser.parse(xmlText);
        const articlesFromXml = get(parsedXml, 'PubmedArticleSet.PubmedArticle', []);
        
        const allArticlesMap = new Map<string, PubMedArticle>();
        
        articlesFromXml.forEach((article: any) => {
            const articleData = get(article, 'MedlineCitation.Article');
            const pmid = get(article, 'MedlineCitation.PMID.#text');

            const titleField = get(articleData, 'ArticleTitle', 'No title available');
            const title = extractText(titleField);
            
            const authorsList = get(articleData, 'AuthorList.Author', []);
            const authors = authorsList.map((author: any) => `${get(author, 'ForeName', '')} ${get(author, 'LastName', '')}`.trim()).filter((name: string) => name);

            const journal = get(articleData, 'Journal.Title', 'N/A');
            
            const pubDate = get(articleData, 'Journal.JournalIssue.PubDate');
            const pubYear = get(pubDate, 'Year', '');
            const pubMonth = get(pubDate, 'Month', '');
            const pubDay = get(pubDate, 'Day', '');
            const publication_date = [pubYear, pubMonth, pubDay].filter(Boolean).join('-');

            const abstractNode = get(articleData, 'Abstract');
            const abstract = extractAbstract(abstractNode);

            // Extract DOI
            const articleIdList = get(article, 'PubmedData.ArticleIdList.ArticleId', []);
            const doiObject = articleIdList.find((id: any) => id['@_IdType'] === 'doi');
            const doi = doiObject ? doiObject['#text'] : undefined;
            
            let fullTextUrl = doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

            const articleObject: PubMedArticle = { title, authors, journal, publication_date, abstract, pmid, doi, fullTextUrl };
            if (pmid) {
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
