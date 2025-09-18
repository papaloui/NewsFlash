
'use server';

import { JSDOM } from 'jsdom';

// Cache the JSON URL to avoid re-scraping the HTML page on every request
let jsonUrlCache: string | null = null;

async function getLegisInfoJsonUrl(): Promise<{ url: string | null, debug: string[], rawHtml?: string }> {
    const debug: string[] = [];
    if (jsonUrlCache) {
        debug.push('Returning cached LegisInfo JSON URL.');
        return { url: jsonUrlCache, debug };
    }

    try {
        const pageUrl = 'https://www.ourcommons.ca/en/open-data#LegisInfo';
        debug.push(`Step 1: Fetching Open Data page from ${pageUrl}`);
        const response = await fetch(pageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch Open Data page: ${response.statusText}`);
        }
        const html = await response.text();
        debug.push('Successfully fetched HTML content.');

        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        debug.push('Step 2: Searching for LegisInfo section.');
        const legisInfoSection = document.getElementById('LegisInfo');
        if (!legisInfoSection) {
            throw new Error('Could not find LegisInfo section on the page.');
        }
        debug.push('Found LegisInfo section. Searching for JSON link within it.');

        const links = Array.from(legisInfoSection.querySelectorAll('a'));
        // Find the link where the href specifically contains the path to the bills JSON data.
        const jsonLink = links.find(link => link.href.includes('legisinfo/en/bills/json'));

        if (jsonLink && jsonLink.href) {
            debug.push(`Found link element with href containing "legisinfo/en/bills/json". Href: ${jsonLink.href}`);
            // The href should be absolute, but we resolve it just in case it's relative.
            const absoluteUrl = new URL(jsonLink.href, pageUrl).toString();
            debug.push(`Step 3: Resolved absolute URL to: ${absoluteUrl}`);
            jsonUrlCache = absoluteUrl; // Cache the found URL
            return { url: absoluteUrl, debug };
        }

        // If not found, return the raw HTML for debugging.
        debug.push('Error: Could not find the JSON download link. Review the raw HTML below.');
        throw new Error('Could not find the JSON download link in the LegisInfo section. Looked for an `a` tag with an `href` containing "legisinfo/en/bills/json".');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        debug.push(`Error during scraping: ${errorMessage}`);
        console.error('Error finding LegisInfo JSON URL:', error);
        // Pass raw HTML back on error for debugging
        const htmlForDebug = (error as any).html || ''; 
        return { url: null, debug, rawHtml: htmlForDebug };
    }
}


export async function getBillsData(): Promise<any> {
    let allDebugMessages: string[] = [];
    let rawHtml: string | undefined;

    try {
        const { url: jsonUrl, debug: scrapeDebug, rawHtml: scrapedHtml } = await getLegisInfoJsonUrl();
        allDebugMessages = allDebugMessages.concat(scrapeDebug);
        rawHtml = scrapedHtml;

        if (!jsonUrl) {
            return { error: 'Failed to find the JSON URL for bills data.', debug: allDebugMessages, rawHtml };
        }

        allDebugMessages.push(`Step 4: Fetching JSON data from ${jsonUrl}`);
        const response = await fetch(jsonUrl, {
            // Revalidate cache every hour to get fresh data
            next: { revalidate: 3600 } 
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch bills JSON data: ${response.statusText}`);
        }
        
        const data = await response.json();
        allDebugMessages.push('Successfully fetched and parsed JSON data.');
        return { ...data, debug: allDebugMessages };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        allDebugMessages.push(`Error fetching JSON data: ${errorMessage}`);
        console.error('Error fetching bills data:', error);
        return { error: errorMessage, debug: allDebugMessages, rawHtml };
    }
}
