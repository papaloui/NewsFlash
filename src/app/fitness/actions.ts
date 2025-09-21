
'use server';

import { rankPubMedArticles, type RankPubMedArticlesInput } from "@/ai/flows/rank-pubmed-articles";
import { XMLParser } from "fast-xml-parser";
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

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

export interface ScrapeResult {
    content: string | null;
    error: string | null;
    log: string[];
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
            const pmidValue = get(article, 'MedlineCitation.PMID.#text');
            if (!pmidValue) return;
            const pmid = String(pmidValue);

            const title = extractText(get(articleData, 'ArticleTitle', 'No title available'));
            const authorsList = get(articleData, 'AuthorList.Author', []).map((a: any) => `${get(a, 'ForeName', '')} ${get(a, 'LastName', '')}`.trim()).filter(Boolean);
            const authors = authorsList;
            const journal = get(articleData, 'Journal.Title', 'N/A');

            const pubDate = get(articleData, 'Journal.JournalIssue.PubDate');
            const pubYear = get(pubDate, 'Year', '');
            const pubMonth = get(pubDate, 'Month', '');
            const pubDay = get(pubDate, 'Day', '');
            const publication_date = [pubYear, pubMonth, pubDay].filter(Boolean).join('-');

            const abstract = extractAbstract(get(articleData, 'Abstract'));
            
            const articleIdList = get(article, 'PubmedData.ArticleIdList.ArticleId', []);
            const doiObject = articleIdList.find((id: any) => id['@_IdType'] === 'doi');
            const doi = doiObject ? doiObject['#text'] : undefined;
            const pmcidObject = articleIdList.find((id: any) => id['@_IdType'] === 'pmc');
            const pmcid = pmcidObject ? pmcidObject['#text'] : undefined;
            
            const articleObject: PubMedArticle = { title, authors, journal, publication_date, abstract, pmid, doi, pmcid };

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


export async function scrapeArticleContent(url: string): Promise<ScrapeResult> {
    const log: string[] = [];
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/'
    };

    try {
        log.push(`1. Initiating scrape for URL: ${url}`);
        log.push(`2. Using headers: ${JSON.stringify(headers, null, 2)}`);

        const response = await fetch(url, { headers, redirect: 'follow' });
        log.push(`3. Received response with status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            throw new Error(`Request failed with status: ${response.status}`);
        }

        log.push(`4. Reading HTML content from response.`);
        const html = await response.text();
        
        log.push(`5. Parsing HTML with JSDOM.`);
        const doc = new JSDOM(html, { url }).window.document;

        // --- Primary Method: Readability ---
        log.push(`6. Attempting extraction with @mozilla/readability.`);
        const reader = new Readability(doc);
        const article = reader.parse();

        if (article && article.textContent && article.textContent.length > 200) {
            log.push(`7. Success (Readability): Extracted content length: ${article.textContent.trim().length} characters.`);
            return { content: article.textContent.trim(), error: null, log };
        } else {
             log.push(`8. Readability found no content or content was too short. Trying fallback selectors.`);
        }

        // --- Fallback Method: Common Selectors ---
        const fallbackSelectors = [
            '.core-container',      // From user example
            'article',
            '.article-body',
            '[role="main"]',
            '#main-content',
            '#content',
            '.post-content',
        ];

        for (const selector of fallbackSelectors) {
            const element = doc.querySelector(selector);
            if (element && element.textContent && element.textContent.trim().length > 200) {
                log.push(`9. Success (Fallback Selector): Found content using selector '${selector}'. Length: ${element.textContent.trim().length} characters.`);
                // Basic text cleanup
                const content = element.textContent.replace(/\s\s+/g, ' ').trim();
                return { content, error: null, log };
            }
        }
        
        log.push(`10. All methods failed. No meaningful content could be extracted.`);
        return { content: null, error: "Readability and all fallback selectors failed to find meaningful content.", log };


    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        log.push(`ERROR: ${errorMessage}`);
        console.error(`Error scraping content for ${url}:`, error);
        return { content: null, error: errorMessage, log };
    }
}
