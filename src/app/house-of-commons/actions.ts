'use server';

import { summarizeHansardSection } from "@/ai/flows/summarize-hansard-section";
import { summarizeHansardTranscript } from "@/ai/flows/summarize-hansard-transcript";

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

export async function getTranscriptSummary(transcript: string): Promise<string> {
    try {
        if (!transcript || transcript.trim().length < 100) {
            return "Not enough content to create a full summary.";
        }
        const result = await summarizeHansardTranscript({ transcript });
        return result.summary;
    } catch (error) {
        console.error("Error getting transcript summary:", error);
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return "An unknown error occurred while creating the summary.";
    }
}
