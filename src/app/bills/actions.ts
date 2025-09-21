
'use server';

import { XMLParser } from "fast-xml-parser";
import { summarizeBills, type SummarizeBillsInput } from "@/ai/flows/summarize-bills";
import { unstable_cache } from 'next/cache';

// Helper function to introduce a delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getBillsData = unstable_cache(
    async (): Promise<any> => {
        try {
            const xmlUrl = 'https://www.parl.ca/legisinfo/en/bills/xml';
            
            const response = await fetch(xmlUrl);

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
    },
    ['federal-bills'], // Cache key
    { revalidate: 3600 } // Revalidate every hour
);

async function getBillText(bill: any): Promise<string> {
    const billTypePath = bill.BillTypeEn.toLowerCase().includes('government') ? 'Government' : 'Private';
    const billNumberForPath = bill.BillNumberFormatted;
    
    const url = `https://www.parl.ca/Content/Bills/${bill.ParliamentNumber}${bill.SessionNumber}/${billTypePath}/${billNumberForPath}/${billNumberForPath}_1/${billNumberForPath}_E.xml`;
    console.log(`[Request Log] Fetching bill text from: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return `Bill text not available for ${bill.BillNumberFormatted}. URL: ${url} (Status: ${response.status}).`;
        }
        const text = await response.text();
        return text;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return `Failed to fetch bill text for ${bill.BillNumberFormatted}. URL: ${url}. Reason: ${errorMessage}`;
    }
}


export async function summarizeBillsFromYesterday(allBills: any[]): Promise<{ summary: string } | { error: string }> {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const billsFromYesterday = allBills.filter(bill => {
            const activityDate = bill.LatestActivityDateTime?.split('T')[0];
            return activityDate === yesterdayStr;
        });
        
        if (billsFromYesterday.length === 0) {
            return { summary: "No bills were updated yesterday." };
        }

        let combinedText = '';
        for (const bill of billsFromYesterday) {
            const text = await getBillText(bill);
            combinedText += `--- BILL ${bill.BillNumberFormatted} ---\n${text}\n\n`;
            await sleep(200); // Add a 200ms delay between requests to be polite
        }
        
        if (!combinedText.trim()) {
            return { error: "Could not retrieve text for any of yesterday's bills. Aborting summarization." };
        }

        const aiInput: SummarizeBillsInput = { billsText: combinedText };
        
        const promptTemplate = `You are a parliamentary analyst. You have been provided with the full text of one or more parliamentary bills from the Canadian Parliament.
Your task is to create a single, coherent report summarizing all of them.
For each bill, generate a concise and neutral summary. Combine these into the final report.
If the text for a bill could not be retrieved, a note will indicate this. Please mention this in your summary for that specific bill.

Here is the full text of the bills:
---
{{{billsText}}}
---

Your JSON Output:
`;
        
        try {
            const result = await summarizeBills(aiInput);
            return result;
        } catch (aiError) {
             const finalPromptForAI = promptTemplate.replace('{{{billsText}}}', combinedText);
             const errorMessage = aiError instanceof Error ? aiError.message : 'An unknown AI error occurred.';
             const debugMessage = `!!! AI SUMMARIZATION FAILED !!!\nError: ${errorMessage}\n\n--- EXACT PROMPT SENT TO AI ---\n\n${finalPromptForAI}`;
             console.error(debugMessage);
             throw new Error(debugMessage);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during summarization.';
        console.error('Error in summarizeBillsFromYesterday:', error);
        return { error: errorMessage };
    }
}
