
import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

interface PubMedArticle {
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

export async function GET(req: NextRequest) {
    const searchTerm = "strength training OR cardiac rehab OR exercise recovery OR cardiovascular exercise";
    const retmax = 20; 

    try {
        // Step 1: ESearch to get recent PMIDs
        const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${retmax}&sort=pub+date&retmode=json&reldate=1`;
        console.log(`[PubMed] Fetching PMIDs from: ${esearchUrl}`);
        
        const esearchResponse = await fetch(esearchUrl);
        if (!esearchResponse.ok) {
            throw new Error(`Failed to fetch from ESearch: ${esearchResponse.statusText}`);
        }
        const esearchData = await esearchResponse.json();
        const pmidList = get(esearchData, 'esearchresult.idlist', []);

        if (!pmidList || pmidList.length === 0) {
            return NextResponse.json([]);
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

        // Step 3: ELink for full-text URLs (one call for all PMIDs)
        const elinkUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&id=${pmidString}&retmode=json`;
        console.log(`[PubMed ELink] Fetching all full text links from: ${elinkUrl}`);
        const elinkResponse = await fetch(elinkUrl);
        let pmidToUrlMap: { [key: string]: string } = {};
        if (elinkResponse.ok) {
            const elinkData = await elinkResponse.json();
            const linksets = get(elinkData, 'linksets', []);
            for (const linkset of linksets) {
                const pmid = get(linkset, 'ids.0');
                if (!pmid) continue;

                const linksetdbs = get(linkset, 'linksetdbs', []);
                // Look for the linksetdb that provides full text links
                const fullTextDb = linksetdbs.find((db: any) => db.linkname === 'pubmed_pubmed_fulltext');

                if (fullTextDb && fullTextDb.links && fullTextDb.links.length > 0) {
                    pmidToUrlMap[pmid] = fullTextDb.links[0];
                }
            }
        } else {
            console.warn(`[PubMed ELink] Failed to fetch full text links: ${elinkResponse.statusText}`);
        }

        // Step 4: Parse XML and combine with ELink results
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
        
        const articles: PubMedArticle[] = articlesFromXml.map((article: any) => {
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
            
            // Get URL from ELink or fallback to DOI
            let fullTextUrl = pmidToUrlMap[pmid];
            if (!fullTextUrl && doi) {
                fullTextUrl = `https://doi.org/${doi}`;
            }

            const formattedArticle: PubMedArticle = {
                title,
                authors,
                journal,
                publication_date,
                abstract,
                pmid,
                doi,
                fullTextUrl
            };

            return formattedArticle;
        }).filter((article: PubMedArticle) => article.title && article.title !== 'No title available');
        
        return NextResponse.json(articles);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error fetching PubMed data:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
