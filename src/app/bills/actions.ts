
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

async function getBillText(bill: any): Promise<string> {
    const billTypePath = bill.BillTypeEn.toLowerCase().includes('government') ? 'Government' : 'Private';
    const billNumberForPath = bill.BillNumberFormatted;
    const billNumberForFile = bill.BillNumberFormatted.replace('-', '');
    
    const url = `https://www.parl.ca/Content/Bills/${bill.ParliamentNumber}${bill.SessionNumber}/${billTypePath}/${billNumberForPath}/${billNumberForFile}_1/${billNumberForFile}_E.xml`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return `Bill text not available. URL: ${url} (Status: ${response.status}). The URL structure may be different for this bill type.`;
        }
        const text = await response.text();
        return text;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return `Failed to fetch bill text. URL: ${url}. Reason: ${errorMessage}`;
    }
}

export async function summarizeBillsFromYesterday(allBills: any[]): Promise<{ summary: string } | { error: string }> {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const billsFromYesterday = allBills.filter(bill => {
            return bill.LatestActivityDateTime.startsWith(yesterdayStr);
        });

        if (billsFromYesterday.length === 0) {
            return { summary: "No bills were updated yesterday." };
        }

        const billsWithText: SummarizeBillsInput = await Promise.all(
            billsFromYesterday.map(async (bill) => {
                const text = await getBillText(bill);
                return {
                    billNumber: bill.BillNumberFormatted,
                    text: text
                };
            })
        );
        
        if (billsWithText.every(b => b.text.startsWith('Bill text not available') || b.text.startsWith('Failed to fetch'))) {
             return { error: `Could not retrieve the text for any of the ${billsFromYesterday.length} bills updated yesterday.` };
        }
        
        const result = await summarizeBills(billsWithText);

        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during summarization.';
        console.error('Error in summarizeBillsFromYesterday:', error);
        return { error: errorMessage };
    }
}
