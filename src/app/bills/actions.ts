
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
    
    const url = `https://www.parl.ca/Content/Bills/${bill.ParliamentNumber}${bill.SessionNumber}/${billTypePath}/${billNumberForPath}/${billNumberForPath}_1/${billNumberForPath}_E.xml`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = `Bill text not available. URL: ${url} (Status: ${response.status}).`;
            return errorText;
        }
        const text = await response.text();
        return text;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorText = `Failed to fetch bill text. URL: ${url}. Reason: ${errorMessage}`;
        return errorText;
    }
}

export async function summarizeBillsFromYesterday(allBills: any[]): Promise<{ summary: string } | { error: string }> {
    const debugLog: string[] = ["Starting Bill Summarization Process..."];
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        debugLog.push(`Filtering for bills updated on ${yesterdayStr}.`);

        const billsFromYesterday = allBills.filter(bill => {
            const activityDate = bill.LatestActivityDateTime?.split('T')[0];
            return activityDate === yesterdayStr;
        });
        
        debugLog.push(`Found ${billsFromYesterday.length} bills from yesterday.`);

        if (billsFromYesterday.length === 0) {
            return { summary: "No bills were updated yesterday." };
        }

        const billTexts = await Promise.all(
            billsFromYesterday.map(async (bill) => {
                const text = await getBillText(bill);
                // Add a header to separate bills
                return `--- BILL ${bill.BillNumberFormatted} ---\n${text}`;
            })
        );
        
        const combinedText = billTexts.join('\n\n');

        if (combinedText.trim() === '' || billsFromYesterday.every(b => (billTexts.find(t => t.includes(b.BillNumberFormatted)) || '').includes('Bill text not available'))) {
             const error = `Could not retrieve the text for any of the ${billsFromYesterday.length} bills updated yesterday.`;
             debugLog.push(error);
             return { error: `${error}\n\nDebug Log:\n${debugLog.join('\n')}` };
        }
        
        const aiInput: SummarizeBillsInput = { billsText: combinedText };
        debugLog.push(`\n===== AI Prompt Input (Combined Text) =====`);
        debugLog.push(`The following combined text (${(combinedText.length / 1024).toFixed(2)} KB) will be provided to the AI for summarization.`);
        debugLog.push("===========================");
        
        const result = await summarizeBills(aiInput);

        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during summarization.';
        debugLog.push(`\n!!! AI SUMMARIZATION FAILED !!!`);
        debugLog.push(errorMessage);
        console.error('Error in summarizeBillsFromYesterday:', error);
        return { error: `AI summarization failed: ${errorMessage}\n\nFull Debug Log:\n${debugLog.join('\n')}` };
    }
}
