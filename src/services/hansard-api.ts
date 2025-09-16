'use server';

import { JSDOM } from 'jsdom';

/**
 * @fileoverview Service for fetching and parsing House of Commons debates from XML.
 */

/**
 * Fetches the transcript content for a specific House of Commons debate from an XML source.
 * @returns An object containing the transcript, the source URL, and the raw XML response for debugging.
 */
export async function getHansardContent(): Promise<{transcript: string; url: string; rawResponse: string;}> {
    
    const xmlUrl = 'https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML';
    console.log(`Fetching Hansard from XML source: ${xmlUrl}`);

    let rawResponse = '';

    try {
        const response = await fetch(xmlUrl, {
             headers: {
                'User-Agent': 'NewsFlash-App/1.0 (contact@example.com)'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch Hansard XML (status: ${response.status}). Response: ${errorText}`);
        }

        const xmlText = await response.text();
        rawResponse = xmlText;

        const dom = new JSDOM(xmlText, { contentType: 'application/xml' });
        const interventions = dom.window.document.querySelectorAll('intervention');

        if (!interventions || interventions.length === 0) {
            return {
                transcript: `No debates found in the XML from ${xmlUrl}.`,
                url: xmlUrl,
                rawResponse
            };
        }

        const transcriptParts: string[] = [];
        interventions.forEach(intervention => {
            const speakerElement = intervention.querySelector('persontitle, personspeaking');
            const speakerName = speakerElement ? speakerElement.textContent?.trim().replace(/:$/, '') : 'Unknown Speaker';
            
            const contentParts: string[] = [];
            intervention.querySelectorAll('p').forEach(p => {
                const textContent = p.textContent?.trim();
                if (textContent) {
                    contentParts.push(textContent);
                }
            });

            const fullContent = contentParts.join(' ');
            if (fullContent) {
                transcriptParts.push(`**${speakerName}**: ${fullContent}`);
            }
        });

        const fullTranscript = transcriptParts.join('\n\n');

        if (!fullTranscript.trim()) {
             return {
                transcript: `Could not parse any content from the interventions in ${xmlUrl}. The structure might have changed.`,
                url: xmlUrl,
                rawResponse
            };
        }

        return { transcript: fullTranscript, url: xmlUrl, rawResponse };

    } catch (error) {
        console.error('Error fetching or parsing Hansard XML content:', error);
        const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred while fetching the Hansard transcript.';
        return { transcript: errorMessage, url: xmlUrl, rawResponse: rawResponse || `Fetching failed: ${errorMessage}` };
    }
}
