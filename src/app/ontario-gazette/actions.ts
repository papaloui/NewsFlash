
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

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

export async function getAndSummarizeOntarioGazette(): Promise<GazetteResult> {
    // This is the page we need to land on to find the download link.
    const gazettePageUrl = 'https://www.ontario.ca/document/ontario-gazette-volume-158-issue-37-september-13-2025';

    try {
        // We are now directly fetching the target page instead of searching for it.
        // This simplifies the process and aligns with the URL you confirmed works.

        // Step 1: Fetch the gazette issue page
        console.log(`[Ontario Gazette] Step 1: Fetching gazette issue page: ${gazettePageUrl}`);
        const gazettePageResponse = await fetch(gazettePageUrl, { headers });
        const gazettePageHtml = await gazettePageResponse.text();
        if (!gazettePageResponse.ok) {
            return { error: `Failed to fetch the gazette issue page. It may be down for maintenance. Status: ${gazettePageResponse.status}`, debugInfo: { step: '1', url: gazettePageUrl, html: gazettePageHtml } };
        }
        
        const dom = new JSDOM(gazettePageHtml);
        const document = dom.window.document;
        
        // Step 2: Find the download link
        console.log(`[Ontario Gazette] Step 2: Searching for "Download" link`);
        const downloadLinks = Array.from(document.querySelectorAll('a'));
        const downloadLink = downloadLinks.find(link => link.textContent?.trim() === 'Download');

        if (!downloadLink || !downloadLink.href) {
            return { error: 'Could not find the "Download" link for the PDF on the issue page.', debugInfo: { step: '2', url: gazettePageUrl, html: gazettePageHtml } };
        }

        const pdfUrl = downloadLink.href; // This should be an absolute URL
        await sleep(500); // Politeness delay

        // Step 3: Fetch the PDF
        console.log(`[Ontario Gazette] Step 3: Fetching PDF from: ${pdfUrl}`);
        const pdfResponse = await fetch(pdfUrl, { headers });
        if (!pdfResponse.ok) {
            // Cannot return HTML for a failed PDF download
            return { error: `Failed to fetch the final PDF. Status: ${pdfResponse.status}`, debugInfo: { step: '3', url: pdfUrl, html: "Not applicable for PDF download." } };
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();

        // Step 4: Summarize
        console.log('[Ontario Gazette] Step 4: Converting to data URI and sending for summarization.');
        const pdfDataUri = `data:application/pdf;base64,${Buffer.from(pdfBuffer).toString('base64')}`;
        const aiInput: SummarizeOntarioGazetteInput = { gazetteDataUri: pdfDataUri };
        const summaryResult = await summarizeOntarioGazette(aiInput);

        return { summary: summaryResult.summary };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getAndSummarizeOntarioGazette:', error);
        return { error: errorMessage, debugInfo: { step: 'Unknown', url: gazettePageUrl, html: 'Error occurred before HTML could be captured.' } };
    }
}
