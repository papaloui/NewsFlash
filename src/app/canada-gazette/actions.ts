
'use server';

import { JSDOM } from 'jsdom';

export async function getLatestGazettePdfLink(): Promise<{ link?: string; error?: string }> {
    const url = 'https://gazette.gc.ca/rp-pr/p1/2025/index-eng.html';
    console.log(`[Request Log] Fetching Canada Gazette index from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Canada Gazette index: ${response.statusText}`);
        }
        const html = await response.text();
        console.log("--- Fetched Canada Gazette HTML ---");
        console.log(html);
        console.log("---------------------------------");
        
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Find all links and filter for the one that contains the specific text pattern.
        const links = Array.from(document.querySelectorAll('a'));
        const gazetteLink = links.find(link => 
            link.textContent?.includes('Part I, volume') && link.href.endsWith('.pdf')
        );

        if (gazetteLink && gazetteLink.href) {
            // The href is relative, so we need to make it absolute.
            const absoluteLink = new URL(gazetteLink.href, 'https://gazette.gc.ca').toString();
            return { link: absoluteLink };
        }

        const errorMessage = 'Could not find the target PDF link on the page. The page structure may have changed. Review the HTML logged to the server console.';
        return { error: errorMessage };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getLatestGazettePdfLink:', error);
        return { error: errorMessage };
    }
}
