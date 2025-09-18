
'use server';

import { JSDOM } from 'jsdom';
import pdf from 'pdf-parse';
import { summarizeGazette, type SummarizeGazetteInput } from '@/ai/flows/summarize-gazette';

interface GazetteResult {
    link?: string;
    summary?: string;
    error?: string;
    html?: string;
}

export async function getAndSummarizeGazette(): Promise<GazetteResult> {
    const indexUrl = 'https://gazette.gc.ca/rp-pr/p1/2025/index-eng.html';
    console.log(`[Request Log] Fetching Canada Gazette index from: ${indexUrl}`);
    
    try {
        // 1. Fetch the index page to find the PDF link
        const indexResponse = await fetch(indexUrl);
        if (!indexResponse.ok) {
            throw new Error(`Failed to fetch Canada Gazette index: ${indexResponse.statusText}`);
        }
        const html = await indexResponse.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const links = Array.from(document.querySelectorAll('a'));
        const gazetteLinkElement = links.find(link => 
            link.textContent?.includes('number 37') && link.href.includes('.pdf')
        );

        if (!gazetteLinkElement || !gazetteLinkElement.href) {
            const errorMessage = 'Could not find the target PDF link on the page. The page structure may have changed.';
            return { error: errorMessage, html };
        }

        const pdfRelativeUrl = gazetteLinkElement.href;
        const pdfAbsoluteUrl = new URL(pdfRelativeUrl, 'https://gazette.gc.ca').toString();

        // 2. Fetch the PDF content
        console.log(`[Request Log] Fetching Gazette PDF from: ${pdfAbsoluteUrl}`);
        const pdfResponse = await fetch(pdfAbsoluteUrl);
        if (!pdfResponse.ok) {
            throw new Error(`Failed to fetch PDF from ${pdfAbsoluteUrl}: ${pdfResponse.statusText}`);
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();

        // 3. Parse the PDF to extract text
        const pdfData = await pdf(pdfBuffer);
        const pdfText = pdfData.text;

        if (!pdfText || pdfText.length < 500) {
            throw new Error('Could not extract a meaningful amount of text from the PDF.');
        }

        // 4. Summarize the text with Genkit
        const aiInput: SummarizeGazetteInput = { gazetteText: pdfText.substring(0, 800000) }; // Use a large chunk of the text
        const summaryResult = await summarizeGazette(aiInput);

        return { link: pdfAbsoluteUrl, summary: summaryResult.summary };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getAndSummarizeGazette:', error);
        return { error: errorMessage };
    }
}
