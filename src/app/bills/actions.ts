
'use server';

import { JSDOM } from 'jsdom';

// Cache the JSON URL to avoid re-scraping the HTML page on every request
let jsonUrlCache: string | null = null;

async function getLegisInfoJsonUrl(): Promise<string> {
    if (jsonUrlCache) {
        return jsonUrlCache;
    }

    try {
        const url = 'https://www.ourcommons.ca/en/open-data#LegisInfo';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Open Data page: ${response.statusText}`);
        }
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        const legisInfoSection = document.getElementById('LegisInfo');
        if (!legisInfoSection) {
            throw new Error('Could not find LegisInfo section on the page.');
        }

        const links = Array.from(legisInfoSection.querySelectorAll('a'));
        const jsonLink = links.find(link => link.textContent?.trim().toUpperCase() === 'JSON');

        if (jsonLink && jsonLink.href) {
            const absoluteUrl = new URL(jsonLink.href, url).toString();
            jsonUrlCache = absoluteUrl; // Cache the found URL
            return absoluteUrl;
        }

        throw new Error('Could not find the JSON download link in the LegisInfo section.');

    } catch (error) {
        console.error('Error finding LegisInfo JSON URL:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('An unknown error occurred while finding the JSON URL.');
    }
}


export async function getBillsData(): Promise<any> {
    try {
        const jsonUrl = await getLegisInfoJsonUrl();
        const response = await fetch(jsonUrl, {
            // Revalidate cache every hour
            next: { revalidate: 3600 } 
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch bills JSON data: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error fetching bills data:', error);
         if (error instanceof Error) {
            return { error: error.message };
        }
        return { error: 'An unknown error occurred while fetching bills data.' };
    }
}
