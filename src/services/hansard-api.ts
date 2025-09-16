'use server';

/**
 * @fileoverview Service for fetching House of Commons debates from OpenParliament.ca API.
 */

interface Intervention {
    content: string; // This is HTML content
    speaker_name: string;
}

interface DebateApiResponse {
    objects: Intervention[];
}


/**
 * Fetches the transcript content for a specific date's House of Commons debate from the OpenParliament API.
 * @returns An object containing the transcript, the source URL, and the raw API response for debugging.
 */
export async function getHansardContent(): Promise<{transcript: string; url: string; rawResponse: string;}> {
    
    const date = new Date('2025-09-15T12:00:00Z'); // Use the date requested by the user, ensuring it's parsed correctly
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const apiUrl = `https://openparliament.ca/debates/${year}/${month}/${day}.json`;
    console.log(`Fetching Hansard from OpenParliament API: ${apiUrl}`);

    let rawResponse = '';

    try {
        const response = await fetch(apiUrl, {
             headers: {
                'User-Agent': 'NewsFlash-App/1.0 (contact@example.com)' // Be a good API citizen
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch Hansard content (status: ${response.status}). Response: ${errorText}`);
        }

        const data: DebateApiResponse = await response.json();
        rawResponse = JSON.stringify(data, null, 2);

        if (!data.objects || data.objects.length === 0) {
            return {
                transcript: `No debates found on OpenParliament.ca for ${year}-${month}-${day}. This could be because the House was not in session.`,
                url: apiUrl,
                rawResponse
            };
        }

        const transcriptParts: string[] = [];
        data.objects.forEach(intervention => {
            // Strip HTML tags from the content
            const textContent = intervention.content.replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
            if (textContent) {
                transcriptParts.push(`**${intervention.speaker_name}**: ${textContent}`);
            }
        });

        const fullTranscript = transcriptParts.join('\n\n');

        return { transcript: fullTranscript, url: apiUrl, rawResponse };

    } catch (error) {
        console.error('Error fetching or parsing Hansard content from API:', error);
        const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred while fetching the Hansard transcript.';
        return { transcript: errorMessage, url: apiUrl, rawResponse: rawResponse || `Fetching failed: ${errorMessage}` };
    }
}
