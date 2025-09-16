'use server';

import { getHansardContent } from '@/services/hansard-api';
import { summarizeHansard } from '@/ai/flows/summarize-hansard';

export interface HansardSummaryResponse {
    summary: string;
    debugInfo?: {
        url: string;
        transcript: string;
    }
}

/**
 * Fetches the Hansard transcript and returns an AI-generated summary,
 * along with debug information.
 */
export async function getHansardSummary(): Promise<HansardSummaryResponse> {
  const { transcript, url } = await getHansardContent();

  const debugInfo = {
      url: url,
      transcript: transcript.substring(0, 5000) + (transcript.length > 5000 ? '... (truncated for display)' : ''),
  };
  
  try {
    if (transcript.startsWith('Error:')) {
        return { summary: transcript, debugInfo };
    }
    
    if (transcript.length < 100) {
        return { summary: "Could not retrieve enough content from the Hansard to generate a summary.", debugInfo };
    }

    const result = await summarizeHansard({ transcript });
    return { summary: result.summary, debugInfo };

  } catch (error) {
    console.error('Error in getHansardSummary action:', error);
    const errorMessage = error instanceof Error ? `An unexpected error occurred: ${error.message}` : 'An unknown error occurred while generating the summary.';
    return { summary: errorMessage, debugInfo };
  }
}
