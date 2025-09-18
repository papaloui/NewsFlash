
'use server';

import { JSDOM } from 'jsdom';
import { summarizeOntarioGazette, type SummarizeOntarioGazetteInput } from '@/ai/flows/summarize-ontario-gazette';

interface GazetteResult {
    summary?: string;
    error?: string;
    debugInfo?: {
        step: string;
        url: string;
        html: string;
    };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getAndSummarizeOntarioGazette(): Promise<GazetteResult> {
    const initialSearchUrl = 'https://www.ontario.ca/search/ontario-gazette';
    const searchText = 'Ontario Gazette Volume 158 Issue 37';

    try {
        // Step 1: Fetch the initial search page
        console.log(`[Ontario Gazette] Step 1: Fetching initial search page: ${initialSearchUrl}`);
        const searchPageResponse = await fetch(initialSearchUrl);
        const searchPageHtml = await searchPageResponse.text();
        if (!searchPageResponse.ok) {
            return { error: 'Failed to fetch the main search page.', debugInfo: { step: '1', url: initialSearchUrl, html: searchPageHtml } };
        }

        let dom = new JSDOM(searchPageHtml);
        let document = dom.window.document;

        // Step 2: Find the link to the specific gazette issue page
        console.log(`[Ontario Gazette] Step 2: Searching for link with text: "${searchText}"`);
        const links = Array.from(document.querySelectorAll('a'));
        const gazettePageLink = links.find(link => link.textContent?.trim() === searchText);

        if (!gazettePageLink || !gazettePageLink.href) {
            return { error: 'Could not find the link to the gazette issue page on the search results.', debugInfo: { step: '2', url: initialSearchUrl, html: searchPageHtml } };
        }
        
        // Links on this site are relative, so we need to make them absolute
        const gazettePageUrl = new URL(gazettePageLink.href, 'https://www.ontario.ca').toString();
        await sleep(500); // Politeness delay

        // Step 3: Fetch the gazette issue page
        console.log(`[Ontario Gazette] Step 3: Fetching gazette issue page: ${gazettePageUrl}`);
        const gazettePageResponse = await fetch(gazettePageUrl);
        const gazettePageHtml = await gazettePageResponse.text();
        if (!gazettePageResponse.ok) {
            return { error: 'Failed to fetch the gazette issue page.', debugInfo: { step: '3', url: gazettePageUrl, html: gazettePageHtml } };
        }
        
        dom = new JSDOM(gazettePageHtml);
        document = dom.window.document;
        
        // Step 4: Find the download link
        console.log(`[Ontario Gazette] Step 4: Searching for "Download" link`);
        const downloadLinks = Array.from(document.querySelectorAll('a'));
        const downloadLink = downloadLinks.find(link => link.textContent?.trim() === 'Download');

        if (!downloadLink || !downloadLink.href) {
            return { error: 'Could not find the "Download" link for the PDF on the issue page.', debugInfo: { step: '4', url: gazettePageUrl, html: gazettePageHtml } };
        }

        const pdfUrl = downloadLink.href; // This should be an absolute URL
        await sleep(500); // Politeness delay

        // Step 5: Fetch the PDF
        console.log(`[Ontario Gazette] Step 5: Fetching PDF from: ${pdfUrl}`);
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
            // Cannot return HTML for a failed PDF download
            return { error: `Failed to fetch the final PDF. Status: ${pdfResponse.status}`, debugInfo: { step: '5', url: pdfUrl, html: "Not applicable for PDF download." } };
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();

        // Step 6: Summarize
        console.log('[Ontario Gazette] Step 6: Converting to data URI and sending for summarization.');
        const pdfDataUri = `data:application/pdf;base64,${Buffer.from(pdfBuffer).toString('base64')}`;
        const aiInput: SummarizeOntarioGazetteInput = { gazetteDataUri: pdfDataUri };
        const summaryResult = await summarizeOntarioGazette(aiInput);

        return { summary: summaryResult.summary };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getAndSummarizeOntarioGazette:', error);
        return { error: errorMessage, debugInfo: { step: 'Unknown', url: initialSearchUrl, html: 'Error occurred before HTML could be captured.' } };
    }
}
