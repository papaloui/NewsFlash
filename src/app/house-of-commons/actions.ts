
'use server';

import { summarizeHansardTranscript } from "@/ai/flows/summarize-hansard-transcript";
import { hansardAgent } from "@/ai/flows/hansard-agent";
import type { SummarizeHansardTranscriptOutput } from "@/lib/schemas";
import { logDebug } from "@/lib/logger";

// In-memory cache for long-running jobs.
// NOTE: In a production, multi-instance environment, you would use a persistent store like Firestore or Redis.
const jobCache = new Map<string, Promise<SummarizeHansardTranscriptOutput>>();

export async function startTranscriptSummary(transcript: string): Promise<{ jobId: string }> {
    logDebug('startTranscriptSummary server action invoked.');
    try {
        if (!transcript || transcript.length === 0) {
            throw new Error("Not enough content to create a full summary.");
        }
        
        const jobId = `summary-${Date.now()}`;
        
        // Start the summarization but don't await it. Store the promise in the cache.
        const summaryPromise = summarizeHansardTranscript({ transcript });
        jobCache.set(jobId, summaryPromise);
        
        logDebug(`Started summary job with ID: ${jobId}`);
        return { jobId };

    } catch (error) {
        console.error("Error starting transcript summary job:", error);
        logDebug('startTranscriptSummary server action failed.', error);
        if (error instanceof Error) {
            throw new Error(`Error starting summary job: ${error.message}`);
        }
        throw new Error("An unknown error occurred while starting the summary job.");
    }
}

export async function checkSummaryJob(jobId: string): Promise<{ status: 'pending' | 'completed' | 'error', result?: SummarizeHansardTranscriptOutput, error?: string }> {
    logDebug(`Checking status for job ID: ${jobId}`);
    
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
        logDebug(`Job ${jobId} is still pending.`);
        return { status: 'pending' };
    }

    try {
        // If it's not 'pending', the promise has resolved. Await it again to get the actual result.
        const finalResult = await summaryPromise;
        logDebug(`Job ${jobId} completed successfully.`);
        jobCache.delete(jobId); // Clean up the cache
        return { status: 'completed', result: finalResult };
    } catch (error) {
        console.error(`Error in completed job ${jobId}:`, error);
        logDebug(`Job ${jobId} failed with an error.`, error);
        jobCache.delete(jobId); // Clean up the cache
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during summarization.";
        return { status: 'error', error: errorMessage };
    }
}


export async function askHansardAgent(transcript: string, summary: string, query: string): Promise<string> {
    try {
        const result = await hansardAgent({ transcript, summary, query });
        return result.response;
    } catch (error) {
        console.error("Error asking Hansard agent:", error);
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return "An unknown error occurred while asking the agent.";
    }
}
