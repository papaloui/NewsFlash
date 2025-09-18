
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

async function getBillText(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Return a detailed error message including the URL
            return `Bill text not available. URL: ${url} (Status: ${response.status}). The URL structure may be different for this bill type.`;
        }
        const text = await response.text();
        return text;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Return a detailed error message including the URL
        return `Failed to fetch bill text. URL: ${url}. Reason: ${errorMessage}`;
    }
}

export async function summarizeBillsFromYesterday(allBills: any[]): Promise<{ summary: string } | { error: string }> {
    try {
        // FOR DEBUGGING: Hardcode a single bill to test the summarization flow.
        const testBillUrl = "https://www.parl.ca/Content/Bills/451/Government/C-2/C-2_1/C-2_E.xml";
        const testBillNumber = "C-2";

        const billText = await getBillText(testBillUrl);

        const billsWithText: SummarizeBillsInput = [{
            billNumber: testBillNumber,
            text: billText
        }];
        
        if (billText.startsWith('Bill text not available') || billText.startsWith('Failed to fetch')) {
             return { error: `Could not process Bill ${testBillNumber}. Reason: ${billText}` };
        }
        
        const result = await summarizeBills(billsWithText);

        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during summarization.';
        console.error('Error in summarizeBillsFromYesterday:', error);
        return { error: errorMessage };
    }
}
