
'use server';

import { summarizeHansardTranscript } from "@/ai/flows/summarize-hansard-transcript";
import { hansardAgent } from "@/ai/flows/hansard-agent";
import type { SummarizeHansardTranscriptOutput } from "@/lib/schemas";
import { logDebug } from "@/lib/logger";

// This function is no longer needed as we are not summarizing sections individually.
// It can be removed or left here for potential future use.
// For now we will comment it out to avoid confusion.
/*
import { summarizeHansardSection } from "@/ai/flows/summarize-hansard-section";
export async function getSectionSummary(sectionText: string): Promise<string> {
    try {
        if (!sectionText || sectionText.trim().length < 50) {
            return "Not enough content to summarize.";
        }
        const result = await summarizeHansardSection({ sectionText });
        return result.summary;
    } catch (error) {
        console.error("Error getting section summary:", error);
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return "An unknown error occurred while summarizing the section.";
    }
}
*/

export async function getTranscriptSummary(transcript: string): Promise<SummarizeHansardTranscriptOutput> {
    logDebug('getTranscriptSummary server action invoked.');
    try {
        if (!transcript || transcript.length === 0) {
            throw new Error("Not enough content to create a full summary.");
        }
        // Return the full result, which includes debugInfo
        const result = await summarizeHansardTranscript({ transcript });
        logDebug('getTranscriptSummary server action completed successfully.');
        return result;
    } catch (error) {
        console.error("Error getting transcript summary:", error);
        logDebug('getTranscriptSummary server action failed.', error);
        if (error instanceof Error) {
            throw new Error(`Error getting transcript summary: ${error.message}`);
        }
        throw new Error("An unknown error occurred while creating the summary.");
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
