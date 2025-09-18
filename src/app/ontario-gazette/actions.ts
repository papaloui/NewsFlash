
'use server';

import { summarizeOntarioGazette, type SummarizeOntarioGazetteInput } from '@/ai/flows/summarize-ontario-gazette';

interface GazetteSummaryResult {
    summary: string;
    sourceUrl: string;
}

// In-memory cache for long-running jobs.
const jobCache = new Map<string, Promise<GazetteSummaryResult>>();

const pdfUrl = 'https://www.ontario.ca/files/2025-09/ontariogazette_158-37.pdf';

async function fetchAndSummarize(): Promise<GazetteSummaryResult> {
     try {
        console.log(`[Ontario Gazette] Starting fetch and summary process for job.`);
        // Step 1: Fetch the PDF directly
        console.log(`[Ontario Gazette] Fetching PDF directly from: ${pdfUrl}`);
        const pdfResponse = await fetch(pdfUrl);
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
        console.error('Error in fetchAndSummarize for Ontario Gazette:', error);
        // Re-throw the error so the promise stored in the cache will be rejected
        throw error;
    }
}


export async function startOntarioGazetteSummary(): Promise<{ jobId: string }> {
    console.log('[Ontario Gazette] startOntarioGazetteSummary server action invoked.');
    try {
        const jobId = `ontario-gazette-summary-${Date.now()}`;
        
        // Start the summarization but don't await it. Store the promise in the cache.
        const summaryPromise = fetchAndSummarize();
        jobCache.set(jobId, summaryPromise);
        
        console.log(`[Ontario Gazette] Started summary job with ID: ${jobId}`);
        return { jobId };

    } catch (error) {
        console.error("[Ontario Gazette] Error starting summary job:", error);
        if (error instanceof Error) {
            throw new Error(`Error starting summary job: ${error.message}`);
        }
        throw new Error("An unknown error occurred while starting the summary job.");
    }
}


export async function checkOntarioGazetteSummaryJob(jobId: string): Promise<{ status: 'pending' | 'completed' | 'error', result?: GazetteSummaryResult, error?: string }> {
    console.log(`[Ontario Gazette] Checking status for job ID: ${jobId}`);
    
    const summaryPromise = jobCache.get(jobId);

    if (!summaryPromise) {
        return { status: 'error', error: 'Job not found.' };
    }

    // Use Promise.race to check status without waiting for the promise to resolve if it's not ready.
    const result = await Promise.race([
        summaryPromise,
        new Promise(resolve => setTimeout(() => resolve('pending'), 100)) // 100ms timeout to check status
    ]);

    if (result === 'pending') {
        console.log(`[Ontario Gazette] Job ${jobId} is still pending.`);
        return { status: 'pending' };
    }

    try {
        // If it's not 'pending', the promise has resolved. Await it again to get the actual result.
        const finalResult = await summaryPromise;
        console.log(`[Ontario Gazette] Job ${jobId} completed successfully.`);
        jobCache.delete(jobId); // Clean up the cache
        return { status: 'completed', result: finalResult };
    } catch (error) {
        console.error(`[Ontario Gazette] Error in completed job ${jobId}:`, error);
        jobCache.delete(jobId); // Clean up the cache
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during summarization.";
        return { status: 'error', error: errorMessage };
    }
}
