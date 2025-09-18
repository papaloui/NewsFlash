
'use server';

import { JSDOM } from 'jsdom';
import { XMLParser } from "fast-xml-parser";

// Cache the data URL to avoid re-scraping the HTML page on every request
let dataUrlCache: string | null = null;

async function getLegisInfoDataUrl(): Promise<{ url: string | null, debug: string[], rawHtml?: string }> {
    const debug: string[] = [];
    if (dataUrlCache) {
        debug.push('Returning cached LegisInfo data URL.');
        return { url: dataUrlCache, debug };
    }
    
    let htmlForDebug: string | undefined;

    try {
        const pageUrl = 'https://www.ourcommons.ca/en/open-data#LegisInfo';
        debug.push(`Step 1: Fetching Open Data page from ${pageUrl}`);
        const response = await fetch(pageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch Open Data page: ${response.statusText}`);
        }
        const html = await response.text();
        htmlForDebug = html; 
        debug.push('Successfully fetched HTML content.');

        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        debug.push('Step 2: Searching for LegisInfo section.');
        const legisInfoSection = document.getElementById('LegisInfo');
        if (!legisInfoSection) {
            throw new Error('Could not find LegisInfo section on the page.');
        }
        debug.push('Found LegisInfo section. Searching for XML link within it.');

        const links = Array.from(legisInfoSection.querySelectorAll('a'));
        const xmlLink = links.find(link => link.href.includes('legisinfo/en/bills/xml'));

        if (xmlLink && xmlLink.href) {
            debug.push(`Found link element with href containing "legisinfo/en/bills/xml". Href: ${xmlLink.href}`);
            const absoluteUrl = new URL(xmlLink.href, pageUrl).toString();
            debug.push(`Step 3: Resolved absolute URL to: ${absoluteUrl}`);
            dataUrlCache = absoluteUrl; 
            return { url: absoluteUrl, debug };
        }

        debug.push('Error: Could not find the XML download link. Review the raw HTML below.');
        throw new Error('Could not find the XML download link in the LegisInfo section. Looked for an `a` tag with an `href` containing "legisinfo/en/bills/xml".');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        debug.push(`Error during scraping: ${errorMessage}`);
        console.error('Error finding LegisInfo XML URL:', error);
        return { url: null, debug, rawHtml: htmlForDebug };
    }
}


export async function getBillsData(): Promise<any> {
    let allDebugMessages: string[] = [];
    let rawHtml: string | undefined;

    try {
        const { url: xmlUrl, debug: scrapeDebug, rawHtml: scrapedHtml } = await getLegisInfoDataUrl();
        allDebugMessages = allDebugMessages.concat(scrapeDebug);
        rawHtml = scrapedHtml;

        if (!xmlUrl) {
            return { error: 'Failed to find the XML URL for bills data.', debug: allDebugMessages, rawHtml };
        }

        allDebugMessages.push(`Step 4: Fetching XML data from ${xmlUrl}`);
        const response = await fetch(xmlUrl, {
            next: { revalidate: 3600 } 
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch bills XML data: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        allDebugMessages.push('Successfully fetched XML data. Parsing...');

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "",
        });
        const data = parser.parse(xmlText);
        allDebugMessages.push('Successfully parsed XML data.');

        // The parsed data has a root 'Bills' key.
        return { Bills: data.Bills.Bill, debug: allDebugMessages };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        allDebugMessages.push(`Error fetching XML data: ${errorMessage}`);
        console.error('Error fetching bills data:', error);
        return { error: errorMessage, debug: allDebugMessages, rawHtml };
    }
}
