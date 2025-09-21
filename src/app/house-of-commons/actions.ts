
'use server';

import { summarizeHansardTranscript } from "@/ai/flows/summarize-hansard-transcript";
import { hansardAgent } from "@/ai/flows/hansard-agent";
import type { SummarizeHansardTranscriptOutput } from "@/lib/schemas";
import { logDebug } from "@/lib/logger";
import { JSDOM } from 'jsdom';

// In-memory cache for long-running jobs.
// NOTE: In a production, multi-instance environment, you would use a persistent store like Firestore or Redis.
const jobCache = new Map<string, Promise<SummarizeHansardTranscriptOutput>>();


export async function startTranscriptSummary(transcript: string): Promise<{ jobId: string }> {
    logDebug('startTranscriptSummary server action invoked.');
    try {
        if (!transcript || transcript.length < 1000) { // Check for a reasonable length
            throw new Error("Transcript is too short to create a meaningful summary.");
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


export async function getSittingDates(): Promise<{ dates: string[], error?: string }> {
    try {
        const url = 'https://www.ourcommons.ca/en/sitting-calendar';
        const response = await fetch(url, { next: { revalidate: 86400 } }); // Revalidate once a day
        if (!response.ok) {
            throw new Error(`Failed to fetch calendar: ${response.statusText}`);
        }
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const sittingDayElements = document.querySelectorAll('td.chamber-meeting');
        const dates: string[] = [];
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        sittingDayElements.forEach(day => {
            for (const className of day.classList) {
                if (dateRegex.test(className)) {
                    dates.push(className);
                    break; // Found the date class, move to the next element
                }
            }
        });

        if (dates.length === 0) {
            throw new Error('No sitting dates found on the calendar page. The selector "td.chamber-meeting" may be incorrect or the page structure has changed.');
        }
        
        return { dates };

    } catch (error) {
        console.error('Error fetching sitting dates:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred while fetching sitting dates.';
        return { dates: [], error: message };
    }
}


export async function getHansardUrlForDate(
    selectedDate: string,
    allSittingDates: string[]
): Promise<{ url: string; log: string[] } | { url: null; log: string[]; error: string }> {
    const log: string[] = [];
    try {
        log.push(`Input: selectedDate = ${selectedDate}`);
        log.push(`Input: allSittingDates = [${allSittingDates.length} dates]`);

        // Ensure dates are sorted chronologically
        const sortedDates = [...allSittingDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        log.push(`Step: Sorted all sitting dates chronologically.`);

        const sittingIndex = sortedDates.findIndex(d => d === selectedDate);
        log.push(`Step: Found index of ${selectedDate} in sorted dates array. Index = ${sittingIndex}`);

        if (sittingIndex === -1) {
            throw new Error(`Selected date ${selectedDate} is not a valid sitting day according to the fetched calendar.`);
        }

        // The sitting number is the index + 1
        const sittingNumber = sittingIndex + 1;
        log.push(`Step: Calculated sitting number. Number = ${sittingNumber}`);

        // Format the sitting number to be three digits with leading zeros (e.g., 23 -> "023")
        const formattedSittingNumber = sittingNumber.toString().padStart(3, '0');
        log.push(`Step: Formatted sitting number to three digits. Formatted = "${formattedSittingNumber}"`);

        // Construct the URL
        const url = `https://www.ourcommons.ca/Content/House/451/Debates/${formattedSittingNumber}/HAN${formattedSittingNumber}-E.XML`;
        log.push(`Output: Constructed URL = ${url}`);

        return { url, log };

    } catch (error) {
        console.error(`Error constructing Hansard URL for date ${selectedDate}:`, error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        log.push(`ERROR: ${message}`);
        return { url: null, log, error: message };
    }
}
