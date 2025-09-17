
'use server';

import { summarizeHansardSection } from "@/ai/flows/summarize-hansard-section";
import { summarizeHansardTranscript } from "@/ai/flows/summarize-hansard-transcript";
import { hansardAgent } from "@/ai/flows/hansard-agent";
import type { TranscriptChunk, SummarizeHansardTranscriptOutput } from "@/lib/schemas";
import { logDebug } from "@/lib/logger";

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

export async function getTranscriptSummary(transcriptChunks: TranscriptChunk[]): Promise<SummarizeHansardTranscriptOutput> {
    logDebug('getTranscriptSummary server action invoked.');
    try {
        if (!transcriptChunks || transcriptChunks.length === 0) {
            throw new Error("Not enough content to create a full summary.");
        }
        // Return the full result, which includes debugInfo
        const result = await summarizeHansardTranscript(transcriptChunks);
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
