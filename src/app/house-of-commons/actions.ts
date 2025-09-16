'use server';

import { getHansardContent } from '@/services/hansard-api';
import { summarizeHansard } from '@/ai/flows/summarize-hansard';

/**
 * Fetches the Hansard transcript and returns an AI-generated summary.
 */
export async function getHansardSummary(): Promise<string> {
  try {
    const transcript = await getHansardContent();

    if (transcript.startsWith('Error:')) {
        return transcript;
    }
    
    if (transcript.length < 100) {
        return "Could not retrieve enough content from the Hansard to generate a summary.";
    }

    const result = await summarizeHansard({ transcript });
    return result.summary;
  } catch (error) {
    console.error('Error in getHansardSummary action:', error);
    if (error instanceof Error) {
        return `An unexpected error occurred: ${error.message}`;
    }
    return 'An unknown error occurred while generating the summary.';
  }
}
