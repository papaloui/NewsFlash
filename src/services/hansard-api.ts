'use server';
import { JSDOM } from 'jsdom';

/**
 * @fileoverview Service for fetching and parsing the House of Commons Hansard.
 */


/**
 * Fetches the transcript content for a given Hansard URL.
 * In a real app, we'd dynamically find the latest sitting URL. For now, we use a fixed one.
 * @returns An object containing the transcript, the source URL, and the raw HTML.
 */
export async function getHansardContent(): Promise<{transcript: string; url: string; html: string;}> {
    // This URL is for a recent, known sitting. A full implementation
    // would require scraping the calendar to find the latest one.
    const hansardUrl = 'https://www.ourcommons.ca/DocumentViewer/en/44-1/house/sitting-260/hansard';
    console.log(`Fetching Hansard from: ${hansardUrl}`);
    let html = '';

    try {
        const response = await fetch(hansardUrl, {
             headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Hansard content (status: ${response.status})`);
        }

        html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const contentElement = document.querySelector('#documentContent');

        if (!contentElement) {
            // If the main content isn't found, the page might not have loaded correctly.
            // We'll return an error in the transcript but still provide the raw HTML for debugging.
            throw new Error('Could not find the main content element (#documentContent) in the Hansard page. The site may be blocking the request or has changed its structure.');
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

        return { transcript: fullTranscript, url: hansardUrl, html };

    } catch (error) {
        console.error('Error fetching or parsing Hansard content:', error);
        const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred while fetching the Hansard transcript.';
        // Even if we fail, return the HTML we managed to get for debugging purposes.
        return { transcript: errorMessage, url: hansardUrl, html: html || `Fetching failed: ${errorMessage}` };
    }
}
