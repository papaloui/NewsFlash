
'use server';

import { rankPubMedArticles, type RankPubMedArticlesInput } from "@/ai/flows/rank-pubmed-articles";
import { XMLParser } from "fast-xml-parser";
import * as tar from 'tar';
import { Readable } from 'stream';

export interface PubMedArticle {
    title: string;
    authors: string[];
    journal: string;
    publication_date: string;
    abstract: string;
    pmid: string; // Ensure pmid is consistently a string
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

function parseNxmlBody(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node + ' ';
    if (Array.isArray(node)) return node.map(parseNxmlBody).join('');

    let text = '';
    if (node['#text']) {
        text += node['#text'] + ' ';
    }
    
    for (const key in node) {
        if (key !== '#text' && !key.startsWith('@_')) {
            text += parseNxmlBody(node[key]);
        }
    }
    
    if(node.p) text += '\n\n';

    return text;
}


async function convertPmidToPmcid(pmid: string): Promise<string> {
    const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${pmid}&format=json`;
    console.log(`[ID Converter] Fetching PMCID for PMID ${pmid} from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`ID Converter API failed with status ${response.status}`);
    }
    const data = await response.json();
    const record = data.records?.[0];
    if (record && record.pmcid) {
        return record.pmcid;
    }
    throw new Error(`PMCID not found for PMID ${pmid}. The article may not be in PubMed Central.`);
}

export async function getArticleFullText(pmid: string): Promise<string> {
    try {
        // Step 1: Convert PMID to PMCID
        const pmcid = await convertPmidToPmcid(pmid);
        await sleep(200);

        // Step 2: Use PMCID to query the OA Web Service API
        const oaUrl = `https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi?id=${pmcid}`;
        console.log(`[OA API] Fetching download link for ${pmcid} from ${oaUrl}`);
        const oaResponse = await fetch(oaUrl);
        if (!oaResponse.ok) {
            throw new Error(`OA API failed with status ${oaResponse.status}`);
        }
        const oaXmlText = await oaResponse.text();

        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
        const oaData = parser.parse(oaXmlText);
        
        const tgzLink = get(oaData, 'OA.records.record.link')?.find((l: any) => l['@_format'] === 'tgz');
        if (!tgzLink || !tgzLink['@_href']) {
            return `Error: Full text not available in the PMC Open Access subset for PMCID ${pmcid}.`;
        }

        const ftpUrl = tgzLink['@_href'];
        console.log(`[OA API] Found .tar.gz link: ${ftpUrl}`);
        await sleep(200);

        // Step 3: Fetch the .tar.gz file
        const ftpResponse = await fetch(ftpUrl);
        if (!ftpResponse.ok) {
            throw new Error(`Failed to download .tar.gz file from ${ftpUrl}: Status ${ftpResponse.status}`);
        }

        // Step 4: Decompress and find the .nxml file
        const arrayBuffer = await ftpResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let nxmlContent: string | null = null;
        
        const readableStream = Readable.from(buffer);
        const parserStream = readableStream.pipe(new tar.Parse());

        await new Promise<void>((resolve, reject) => {
            parserStream.on('entry', (entry: tar.ReadEntry) => {
                if (entry.path.endsWith('.nxml')) {
                    console.log(`[TAR] Found .nxml file: ${entry.path}`);
                    let content = '';
                    entry.on('data', chunk => {
                        content += chunk.toString('utf-8');
                    });
                    entry.on('end', () => {
                        nxmlContent = content;
                        resolve(); 
                    });
                } else {
                    entry.resume(); // Skip other files
                }
            });

            parserStream.on('end', () => {
                if (nxmlContent === null) {
                    reject(new Error('Could not find an .nxml file in the archive.'));
                } else {
                    resolve();
                }
            });

            parserStream.on('error', (err) => {
                reject(err);
            });
        });
        
        if (!nxmlContent) {
            throw new Error("Extraction completed but NXML content is missing.");
        }

        // Step 5: Parse the .nxml content
        const nxmlParser = new XMLParser({
            ignoreAttributes: true,
            trimValues: true,
            textNodeName: "#text",
        });

        const parsedNxml = nxmlParser.parse(nxmlContent);
        const bodyNode = get(parsedNxml, 'article.body');

        if (!bodyNode) {
            return "Error: Could not find the 'body' of the article in the NXML file.";
        }

        const fullText = parseNxmlBody(bodyNode);
        const cleanedText = fullText.replace(/\s\s+/g, ' ').trim();
        
        if (cleanedText.length < 100) {
            return "Error: Extracted very little text from the NXML. It may be a stub or an unsupported format.";
        }

        return cleanedText;

    } catch (error) {
        console.error(`Error fetching or parsing full article for PMID ${pmid}:`, error);
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return "An unknown error occurred while fetching the article text.";
    }
}
