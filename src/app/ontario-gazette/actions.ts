
'use server';

import { summarizeOntarioGazette, type SummarizeOntarioGazetteInput } from '@/ai/flows/summarize-ontario-gazette';

interface GazetteResult {
    summary?: string;
    error?: string;
    sourceUrl?: string;
}

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

export async function getAndSummarizeOntarioGazette(): Promise<GazetteResult> {
    // Using the direct PDF URL is a more robust solution than multi-step scraping.
    const pdfUrl = 'https://www.ontario.ca/files/2025-09/ontariogazette_158-37.pdf';

    try {
        // Step 1: Fetch the PDF directly
        console.log(`[Ontario Gazette] Fetching PDF directly from: ${pdfUrl}`);
        const pdfResponse = await fetch(pdfUrl, { headers });
        if (!pdfResponse.ok) {
            throw new Error(`Failed to fetch the PDF from ${pdfUrl}. Status: ${pdfResponse.status}`);
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();

        // Step 2: Summarize by passing the PDF data directly to the AI model
        console.log('[Ontario Gazette] Converting to data URI and sending for summarization.');
        const pdfDataUri = `data:application/pdf;base64,${Buffer.from(pdfBuffer).toString('base64')}`;
        const aiInput: SummarizeOntarioGazetteInput = { gazetteDataUri: pdfDataUri };
        const summaryResult = await summarizeOntarioGazette(aiInput);

        return { summary: summaryResult.summary, sourceUrl: pdfUrl };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getAndSummarizeOntarioGazette:', error);
        return { error: errorMessage, sourceUrl: pdfUrl };
    }
}
