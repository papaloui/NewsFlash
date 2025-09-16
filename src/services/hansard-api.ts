'use server';
import { JSDOM } from 'jsdom';

/**
 * @fileoverview Service for fetching and parsing the House of Commons Hansard.
 */


/**
 * Fetches the transcript content for a given Hansard URL.
 * In a real app, we'd dynamically find the latest sitting URL. For now, we use a fixed one.
 * @returns The text content of the Hansard transcript.
 */
export async function getHansardContent(): Promise<string> {
    // This URL is for a recent, known sitting. A full implementation
    // would require scraping the calendar to find the latest one.
    const hansardUrl = 'https://www.ourcommons.ca/DocumentViewer/en/44-1/house/sitting-260/hansard';
    console.log(`Fetching Hansard from: ${hansardUrl}`);

    try {
        const response = await fetch(hansardUrl, {
             headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Hansard content (status: ${response.status})`);
        }

        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const contentElement = document.querySelector('#documentContent');

        if (!contentElement) {
            throw new Error('Could not find the main content element (#documentContent) in the Hansard page.');
        }

        // The debate content is in cards with the class 'paratext'.
        // We select all of them and join their text content.
        const paraTextElements = contentElement.querySelectorAll('.paratext');
        if (!paraTextElements || paraTextElements.length === 0) {
            throw new Error("Could not find any 'paratext' elements within #documentContent. The page structure may have changed.");
        }
        
        const transcriptParts: string[] = [];
        paraTextElements.forEach(el => {
            // Get text and clean up whitespace
            const text = el.textContent?.replace(/\s\s+/g, ' ').trim();
            if (text) {
                transcriptParts.push(text);
            }
        });

        const fullTranscript = transcriptParts.join('\n\n');

        return fullTranscript;

    } catch (error) {
        console.error('Error fetching or parsing Hansard content:', error);
        if (error instanceof Error) {
            return `Error: ${error.message}`;
        }
        return 'An unknown error occurred while fetching the Hansard transcript.';
    }
}
