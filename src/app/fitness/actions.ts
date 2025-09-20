
'use server';

import { getArticleContent as extractArticle } from "@/app/actions";
import { XMLParser } from "fast-xml-parser";
import { summarizeFullArticleText } from "@/ai/flows/summarize-full-article";

export interface PubMedArticle {
    title: string;
    authors: string[];
    journal: string;
    publication_date: string;
    abstract: string;
    pmid: string;
    doi?: string;
    fullTextUrl?: string;
    body?: string;
    isBodyLoading?: boolean;
    summary?: string;
    isSummarizing?: boolean;
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


export async function getPubMedArticles(): Promise<{ articles?: PubMedArticle[], error?: string }> {
    const searchTerm = "strength training";
    const retmax = 20;

    try {
        const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${retmax}&sort=pub+date&retmode=json&reldate=1`;
        const esearchResponse = await fetch(esearchUrl);
        if (!esearchResponse.ok) throw new Error(`Failed ESearch: ${esearchResponse.statusText}`);
        const esearchData = await esearchResponse.json();
        const pmidList = get(esearchData, 'esearchresult.idlist', []);
        if (!pmidList || pmidList.length === 0) return { articles: [] };

        const pmidString = pmidList.join(',');
        await sleep(200);

        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmidString}&retmode=xml`;
        const efetchResponse = await fetch(efetchUrl);
        if (!efetchResponse.ok) throw new Error(`Failed EFetch: ${efetchResponse.statusText}`);
        const xmlText = await efetchResponse.text();
        await sleep(200);

        const elinkUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&id=${pmidString}&retmode=json`;
        const elinkResponse = await fetch(elinkUrl);
        let pmidToUrlMap: { [key: string]: string } = {};
        if (elinkResponse.ok) {
            const elinkData = await elinkResponse.json();
            const linksets = get(elinkData, 'linksets', []);
            for (const linkset of linksets) {
                const pmid = get(linkset, 'ids.0');
                if (!pmid) continue;
                const fullTextDb = get(linkset, 'linksetdbs', []).find((db: any) => db.linkname === 'pubmed_pubmed_fulltext');
                if (fullTextDb && fullTextDb.links && fullTextDb.links.length > 0) {
                    pmidToUrlMap[pmid] = fullTextDb.links[0];
                }
            }
        }

        const parser = new XMLParser({
            ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: true,
            trimValues: true, textNodeName: "#text",
            isArray: (name) => ['PubmedArticle', 'Author', 'AbstractText', 'ArticleId'].includes(name)
        });
        const parsedXml = parser.parse(xmlText);
        const articlesFromXml = get(parsedXml, 'PubmedArticleSet.PubmedArticle', []);
        
        const articles: PubMedArticle[] = articlesFromXml.map((article: any) => {
            const articleData = get(article, 'MedlineCitation.Article');
            const pmid = get(article, 'MedlineCitation.PMID.#text');
            const title = extractText(get(articleData, 'ArticleTitle', 'No title available'));
            const authors = get(articleData, 'AuthorList.Author', []).map((a: any) => `${get(a, 'ForeName', '')} ${get(a, 'LastName', '')}`.trim()).filter(Boolean);
            const journal = get(articleData, 'Journal.Title', 'N/A');
            const pubDate = get(articleData, 'Journal.JournalIssue.PubDate');
            const publication_date = [get(pubDate, 'Year', ''), get(pubDate, 'Month', ''), get(pubDate, 'Day', '')].filter(Boolean).join('-');
            const abstract = extractAbstract(get(articleData, 'Abstract'));
            const doiObject = get(article, 'PubmedData.ArticleIdList.ArticleId', []).find((id: any) => id['@_IdType'] === 'doi');
            const doi = doiObject ? doiObject['#text'] : undefined;
            
            let fullTextUrl = pmidToUrlMap[pmid];
            if (!fullTextUrl && doi) fullTextUrl = `https://doi.org/${doi}`;

            return { title, authors, journal, publication_date, abstract, pmid, doi, fullTextUrl };
        }).filter((a: PubMedArticle) => a.title && a.title !== 'No title available');
        
        return { articles };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getPubMedArticles:', error);
        return { error: errorMessage };
    }
}


export async function getFullArticleText(url: string): Promise<string> {
    if (!url) {
        return "No URL provided.";
    }
    return await extractArticle(url);
}

export async function summarizeFullArticle(articleText: string): Promise<string> {
    if (!articleText) {
        return "No article text provided to summarize.";
    }
    try {
        const result = await summarizeFullArticleText({ articleText });
        return result.summary;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown AI error occurred.";
        console.error("Error summarizing article:", error);
        throw new Error(errorMessage);
    }
}
