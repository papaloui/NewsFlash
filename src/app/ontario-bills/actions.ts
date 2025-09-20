
'use server';

import { JSDOM } from 'jsdom';

export interface OntarioBill {
    billNumber: string;
    title: string;
    link: string;
    sponsors: string[];
}

export async function getOntarioBills(): Promise<{ bills?: OntarioBill[], error?: string, html?: string }> {
    const url = 'https://www.ola.org/en/legislative-business/bills/parliament-44/session-1/';
    console.log(`[Request Log] Fetching Ontario Bills from: ${url}`);
    let html = '';

    try {
        const response = await fetch(url);
        html = await response.text();
        if (!response.ok) {
            throw new Error(`Failed to fetch Ontario bills page: ${response.statusText}`);
        }
        
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const table = document.querySelector('table.views-table.views-view-table.cols-3');
        if (!table) {
            throw new Error('Could not find the bills table on the page using selector "table.views-table.views-view-table.cols-3". The page structure may have changed.');
        }

        const bills: OntarioBill[] = [];
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            const billNumber = cells[0].textContent?.trim() || 'N/A';
            const titleElement = cells[1].querySelector('a');
            const title = titleElement?.textContent?.trim() || 'No Title';
            const link = titleElement ? new URL(titleElement.href, 'https://www.ola.org').toString() : '#';
            
            const sponsorElements = cells[2].querySelectorAll('.field--name-field-full-name-by-last-name');
            const sponsors = Array.from(sponsorElements).map(el => el.textContent?.trim() || '').filter(s => s);

            bills.push({ billNumber, title, link, sponsors });
        });

        if (bills.length === 0) {
            // This case is also an error, as we expect bills.
            throw new Error('No bills were found in the table. The table might be empty or the structure has changed.');
        }

        return { bills };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getOntarioBills:', error);
        return { error: errorMessage, html: html };
    }
}
