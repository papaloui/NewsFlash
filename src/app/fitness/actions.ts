
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
    pmcid?: string;
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
    // Updated search term to target PMC's open access subset
    const searchTerm = `"loattrfree full text"[filter] AND ("strength training" OR "exercise recovery" OR "sports performance" OR "athlete")`;
    const retmax = 50; 

    try {
        // Step 1: ESearch PMC database for open access articles from the last 7 days
        const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodeURIComponent(searchTerm)}&retmax=${retmax}&sort=pub+date&reldate=7&retmode=json`;
        console.log(`[PMC] Fetching article IDs from: ${esearchUrl}`);
        const esearchResponse = await fetch(esearchUrl);
        if (!esearchResponse.ok) throw new Error(`Failed ESearch on PMC: ${esearchResponse.statusText}`);

        const esearchText = await esearchResponse.text();
        if (esearchText.trim().startsWith('<')) {
            throw new Error(`PMC ESearch returned an unexpected XML response instead of JSON. Content: ${esearchText.slice(0, 200)}`);
        }
        const esearchData = JSON.parse(esearchText);

        const idList = get(esearchData, 'esearchresult.idlist', []);
        if (!idList || idList.length === 0) return { articles: [] };

        const idString = idList.join(',');
        await sleep(200);

        // Step 2: EFetch from PMC database to get full article data
        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${idString}&retmode=xml`;
        console.log(`[PMC] Fetching article data from: ${efetchUrl}`);
        const efetchResponse = await fetch(efetchUrl);
        if (!efetchResponse.ok) throw new Error(`Failed EFetch on PMC: ${efetchResponse.statusText}`);
        const xmlText = await efetchResponse.text();
        
        const parser = new XMLParser({
            ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: true,
            trimValues: true, textNodeName: "#text",
            isArray: (name) => ['article', 'author', 'abstract', 'article-id'].includes(name)
        });
        const parsedXml = parser.parse(xmlText);
        const articlesFromXml = get(parsedXml, 'pmc-articleset.article', []);
        
        const allArticlesMap = new Map<string, PubMedArticle>();
        
        articlesFromXml.forEach((article: any) => {
            const front = get(article, 'front.article-meta');
            if (!front) return;

            const pmidObj = get(front, 'article-id', []).find((id: any) => id['@_pub-id-type'] === 'pmid');
            const pmid = pmidObj ? String(pmidObj['#text']) : null;
            if (!pmid) return; // We need a PMID to rank and map

            const title = extractText(get(front, 'title-group.article-title', 'No title available'));
            
            const authorsList = get(front, 'contrib-group.contrib', [])
                .filter((c: any) => c['@_contrib-type'] === 'author')
                .map((a: any) => `${get(a, 'name.given-names', '')} ${get(a, 'name.surname', '')}`.trim())
                .filter(Boolean);

            const journal = get(front, 'journal-meta.journal-title-group.journal-title', 'N/A');

            const pubDate = get(front, 'pub-date', [])[0]; // Get first pub date
            const pubYear = get(pubDate, 'year', '');
            const pubMonth = get(pubDate, 'month', '');
            const pubDay = get(pubDate, 'day', '');
            const publication_date = [pubYear, pubMonth, pubDay].filter(Boolean).join('-');

            const abstract = extractAbstract(get(front, 'abstract.0', get(article, 'body')));
            
            const doiObj = get(front, 'article-id', []).find((id: any) => id['@_pub-id-type'] === 'doi');
            const doi = doiObj ? doiObj['#text'] : undefined;
            const pmcidObj = get(front, 'article-id', []).find((id: any) => id['@_pub-id-type'] === 'pmc');
            const pmcid = pmcidObj ? `PMC${pmcidObj['#text']}` : undefined;

            const articleObject: PubMedArticle = { title, authors: authorsList, journal, publication_date, abstract, pmid, doi, pmcid };

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
