
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


export async function getSittingDates(): Promise<string[]> {
    try {
        const url = 'https://www.ourcommons.ca/en/sitting-calendar';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch calendar: ${response.statusText}`);
        }
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const sittingDays = document.querySelectorAll('.chamber-meeting');
        const dates: string[] = [];
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        sittingDays.forEach(day => {
            day.classList.forEach(className => {
                if (dateRegex.test(className)) {
                    dates.push(className);
                }
            });
        });
        
        return dates;

    } catch (error) {
        console.error('Error fetching sitting dates:', error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error('An unknown error occurred while fetching sitting dates.');
    }
}


export async function getHansardLinkForDate(date: string): Promise<string | null> {
    try {
        const url = `https://www.ourcommons.ca/en/parliamentary-business/${date}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch parliamentary business page for ${date}: ${response.statusText}`);
        }
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const links = document.querySelectorAll('a');
        let hansardLink: string | null = null;
        
        links.forEach(link => {
            if (link.textContent?.trim() === 'Debates (Hansard)') {
                hansardLink = link.href;
            }
        });
        
        if (hansardLink) {
             // The link is relative, so make it absolute
            return new URL(hansardLink, 'https://www.ourcommons.ca').toString();
        }

        return null;

    } catch (error) {
        console.error(`Error fetching Hansard link for date ${date}:`, error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error('An unknown error occurred while fetching the Hansard link.');
    }
}


export async function getHansardXmlLink(hansardUrl: string): Promise<string | null> {
    try {
        const response = await fetch(hansardUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch Hansard page (${hansardUrl}): ${response.statusText}`);
        }
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const links = Array.from(document.querySelectorAll('a'));
        const xmlLink = links.find(link => link.textContent?.trim().includes('XML'));
        
        if (xmlLink && xmlLink.href) {
            // The href should be absolute on this page.
            return xmlLink.href;
        }

        return null;
    } catch (error) {
        console.error(`Error fetching or parsing Hansard page for XML link (${hansardUrl}):`, error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error('An unknown error occurred while finding the XML link.');
    }
}
