
'use server';

import { XMLParser } from "fast-xml-parser";

export async function getBillsData(): Promise<any> {
    const allDebugMessages: string[] = [];
    
    try {
        const xmlUrl = 'https://www.parl.ca/legisinfo/en/bills/xml';
        allDebugMessages.push(`Fetching XML data directly from: ${xmlUrl}`);

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
        return { error: errorMessage, debug: allDebugMessages };
    }
}
