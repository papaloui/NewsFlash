
import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

interface PubMedArticle {
    title: string;
    authors: string[];
    journal: string;
    publication_date: string;
    abstract: string;
    pmid: string;
    fullTextUrl?: string;
}

const get = (obj: any, path: string, defaultValue: any = null) => {
    const value = path.split('.').reduce((acc, c) => (acc && acc[c]) ? acc[c] : undefined, obj);
    return value === undefined ? defaultValue : value;
};

// Helper function to extract text from a potentially complex title object
const extractText = (field: any): string => {
    if (typeof field === 'string') {
        return field;
    }
    if (typeof field === 'object' && field !== null && field['#text']) {
        return field['#text'];
    }
    if (typeof field === 'object' && field !== null) {
        // Fallback for cases with nested tags like <i> or <sub>
        return Object.values(field).flat().map(extractText).join('');
    }
    return 'No title available';
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(req: NextRequest) {
    const searchTerm = "strength training OR cardiac rehab OR exercise recovery OR cardiovascular exercise";
    const retmax = 50; // Number of articles to retrieve

    try {
        // Step 1: Use ESearch to get recent article PMIDs
        const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${retmax}&sort=pub+date&retmode=json&reldate=1`;
        console.log(`[PubMed] Fetching PMIDs from: ${esearchUrl}`);
        
        const esearchResponse = await fetch(esearchUrl);
        if (!esearchResponse.ok) {
            throw new Error(`Failed to fetch from ESearch: ${esearchResponse.statusText}`);
        }
        const esearchData = await esearchResponse.json();
        const pmidList = esearchData.esearchresult?.idlist;

        if (!pmidList || pmidList.length === 0) {
            return NextResponse.json([]); // No new articles found
        }

        const pmidString = pmidList.join(',');

        // Step 2: Use EFetch to get article metadata and abstracts
        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmidString}&retmode=xml`;
        console.log(`[PubMed] Fetching article data from: ${efetchUrl}`);

        const efetchResponse = await fetch(efetchUrl);
        if (!efetchResponse.ok) {
            throw new Error(`Failed to fetch from EFetch: ${efetchResponse.statusText}`);
        }
        const xmlText = await efetchResponse.text();

        // Step 3: Convert XML to JSON
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            parseTagValue: true,
            trimValues: true,
            textNodeName: "#text",
            isArray: (name, jpath, isLeafNode, isAttribute) => {
                 const arrayPaths = new Set(['PubmedArticle', 'Author']);
                 return arrayPaths.has(name);
            }
        });
        const parsedXml = parser.parse(xmlText);
        
        const articlesFromXml = get(parsedXml, 'PubmedArticleSet.PubmedArticle', []);

        // Step 4: Format the articles into the desired JSON structure and fetch full text links
        const articles: PubMedArticle[] = [];
        for (const article of articlesFromXml) {
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

            const abstractTexts = get(articleData, 'Abstract.AbstractText', []);
            const abstract = Array.isArray(abstractTexts) 
                ? abstractTexts.map(t => typeof t === 'object' ? t['#text'] : t).join('\n')
                : (typeof abstractTexts === 'object' ? abstractTexts['#text'] : abstractTexts);
            
            const formattedArticle: PubMedArticle = {
                title,
                authors,
                journal,
                publication_date,
                abstract: abstract || 'No abstract available.',
                pmid
            };

            // Step 5: Use ELink to get the full-text URL
            if (pmid) {
                const elinkUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&id=${pmid}&retmode=json`;
                console.log(`[PubMed ELink] Fetching full text link for PMID ${pmid} from: ${elinkUrl}`);
                try {
                    const elinkResponse = await fetch(elinkUrl);
                    if (elinkResponse.ok) {
                        const elinkData = await elinkResponse.json();
                        const linksetdbs = get(elinkData, 'linksets.0.linksetdbs', []);
                        const fullTextDb = linksetdbs.find((db: any) => db.linkname === 'pubmed_pubmed_fulltext');
                        if (fullTextDb && fullTextDb.links && fullTextDb.links.length > 0) {
                            formattedArticle.fullTextUrl = fullTextDb.links[0];
                            console.log(`[PubMed ELink] Found full text link: ${formattedArticle.fullTextUrl}`);
                        }
                    }
                } catch (elinkError) {
                    console.error(`[PubMed ELink] Failed to fetch full text link for PMID ${pmid}`, elinkError);
                }
                await sleep(200); // Be polite to the API
            }


            if (formattedArticle.title && formattedArticle.title !== 'No title available') {
                 articles.push(formattedArticle);
            }
        }


        return NextResponse.json(articles);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error fetching PubMed data:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
