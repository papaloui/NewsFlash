
'use server';

import { summarizeOntarioDebate, type SummarizeOntarioDebateInput } from '@/ai/flows/summarize-ontario-debate';

interface DebateSummaryResult {
    summary?: string;
    error?: string;
    sourceUrl?: string;
}

export async function getAndSummarizeDebate(): Promise<DebateSummaryResult> {
    // For now, we will use the hardcoded URL the user provided.
    // In the future, we will build logic to find the latest debate URL dynamically.
    const pdfUrl = 'https://www.ola.org/sites/default/files/node-files/hansard/document/pdf/2025/2025-06/05-JUN-2025_L023_0.pdf';
    console.log(`[Request Log] Fetching Ontario Debate PDF from: ${pdfUrl}`);
    
    try {
        // 1. Fetch the PDF content
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
            throw new Error(`Failed to fetch PDF from ${pdfUrl}: ${pdfResponse.statusText}`);
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();

        // 2. Convert PDF buffer to a Base64 data URI
        const pdfDataUri = `data:application/pdf;base64,${Buffer.from(pdfBuffer).toString('base64')}`;

        // 3. Summarize the text with Genkit
        const aiInput: SummarizeOntarioDebateInput = { debateDataUri: pdfDataUri };
        const summaryResult = await summarizeOntarioDebate(aiInput);

        return { summary: summaryResult.summary, sourceUrl: pdfUrl };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getAndSummarizeDebate:', error);
        return { error: errorMessage, sourceUrl: pdfUrl };
    }
}
