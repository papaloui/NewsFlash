
'use server';

import { XMLParser } from "fast-xml-parser";
import { summarizeBills, type SummarizeBillsInput } from "@/ai/flows/summarize-bills";

export async function getBillsData(): Promise<any> {
    try {
        const xmlUrl = 'https://www.parl.ca/legisinfo/en/bills/xml';
        
        const response = await fetch(xmlUrl, {
            next: { revalidate: 3600 } 
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch bills XML data from ${xmlUrl}: ${response.statusText}`);
        }
        
        const xmlText = await response.text();

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "",
            parseTagValue: (tagName, tagValue, jPath, isLeafNode, isAttribute) => {
                if (tagValue === '' && (jPath.endsWith('Id') || jPath.endsWith('Number'))) {
                    return 0;
                }
                return tagValue;
            },
            tagValueProcessor: (tagName, tagValue) => {
                 if (tagValue && typeof tagValue === 'string') {
                    return tagValue.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                }
                return tagValue;
            }
        });

        const data = parser.parse(xmlText);

        if (!data.Bills || !data.Bills.Bill) {
            throw new Error("Parsed XML data does not contain 'Bills.Bill' property as expected.");
        }

        return { Bills: data.Bills.Bill };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in getBillsData:', error);
        return { error: errorMessage };
    }
}

function getBillTextUrl(bill: any): string {
    const parliamentSession = `${bill.ParliamentNumber}${bill.SessionNumber}`;
    const billNumberClean = bill.BillNumberFormatted.replace('-', '');
    let billTypePath = 'Private'; // Default to Private

    if (bill.BillTypeEn.toLowerCase().includes('government')) {
        billTypePath = 'Government';
    } else if (bill.BillTypeEn.toLowerCase().includes('private member')) {
        billTypePath = 'Private';
    } else if (bill.BillTypeEn.toLowerCase().includes('senate public bill')) {
        // Senate bills might have a different structure, but we'll try 'Private' as a common case
        billTypePath = 'Private';
    }

    return `https://www.parl.ca/Content/Bills/${parliamentSession}/${billTypePath}/${billNumberClean}/${billNumberClean}_1/${billNumberClean}_E.xml`;
}

async function getBillText(bill: any): Promise<string> {
    const url = getBillTextUrl(bill);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return `Bill text not available at ${url} (Status: ${response.status}). It may not exist or the URL structure is different for this bill type.`;
        }
        const text = await response.text();
        // For now, we are passing the raw XML. A future improvement could be parsing it for cleaner text.
        return text;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return `Failed to fetch bill text from ${url}. Reason: ${errorMessage}`;
    }
}

export async function summarizeBillsFromYesterday(allBills: any[]): Promise<{ summary: string } | { error: string }> {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toISOString().split('T')[0];

        const billsFromYesterday = allBills.filter(bill => {
            return bill.LatestActivityDateTime && bill.LatestActivityDateTime.startsWith(yesterdayString);
        });

        if (billsFromYesterday.length === 0) {
            return { summary: "No bills were updated yesterday." };
        }

        const billsWithText: SummarizeBillsInput = await Promise.all(
            billsFromYesterday.map(async (bill) => {
                const text = await getBillText(bill);
                return { billNumber: bill.BillNumberFormatted, text };
            })
        );
        
        const result = await summarizeBills(billsWithText);

        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during summarization.';
        console.error('Error in summarizeBillsFromYesterday:', error);
        return { error: errorMessage };
    }
}
