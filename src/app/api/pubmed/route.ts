
import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

interface PubMedArticle {
    title: string;
    authors: string[];
    journal: string;
    publication_date: string;
    abstract: string;
    pmid: string;
}

const get = (obj: any, path: string, defaultValue: any = null) => {
    const value = path.split('.').reduce((acc, c) => (acc && acc[c]) ? acc[c] : undefined, obj);
    return value === undefined ? defaultValue : value;
};

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

        // Step 4: Format the articles into the desired JSON structure
        const articles: PubMedArticle[] = articlesFromXml.map((article: any) => {
            const articleData = get(article, 'MedlineCitation.Article');
            const pmid = get(article, 'MedlineCitation.PMID.#text');

            const title = get(articleData, 'ArticleTitle', 'No title available');
            
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

            return {
                title,
                authors,
                journal,
                publication_date,
                abstract: abstract || 'No abstract available.',
                pmid
            };
        }).filter((article: PubMedArticle) => article.title && article.title !== 'No title available');

        return NextResponse.json(articles);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error fetching PubMed data:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
