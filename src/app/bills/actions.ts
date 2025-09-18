
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

async function getBillText(bill: any, debugLog: string[]): Promise<string> {
    const billTypePath = bill.BillTypeEn.toLowerCase().includes('government') ? 'Government' : 'Private';
    const billNumberForPath = bill.BillNumberFormatted;
    
    const url = `https://www.parl.ca/Content/Bills/${bill.ParliamentNumber}${bill.SessionNumber}/${billTypePath}/${billNumberForPath}/${billNumberForPath}_1/${billNumberForPath}_E.xml`;
    debugLog.push(`Requesting URL: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = `Bill text not available. URL: ${url} (Status: ${response.status}).`;
            debugLog.push(`Request FAILED: ${errorText}`);
            return errorText;
        }
        const text = await response.text();
        debugLog.push(`XML content received from ${url}:\n---\n${text}\n---`);
        return text;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorText = `Failed to fetch bill text. URL: ${url}. Reason: ${errorMessage}`;
        debugLog.push(`Request FAILED: ${errorText}`);
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
            return bill.LatestActivityDateTime.startsWith(yesterdayStr);
        });

        debugLog.push(`Found ${billsFromYesterday.length} bills from yesterday.`);

        if (billsFromYesterday.length === 0) {
            return { summary: "No bills were updated yesterday." };
        }

        const billsWithText: SummarizeBillsInput = await Promise.all(
            billsFromYesterday.map(async (bill) => {
                debugLog.push(`\nProcessing Bill: ${bill.BillNumberFormatted}`);
                const text = await getBillText(bill, debugLog);
                return {
                    billNumber: bill.BillNumberFormatted,
                    text: text
                };
            })
        );
        
        if (billsWithText.every(b => b.text.startsWith('Bill text not available') || b.text.startsWith('Failed to fetch'))) {
             const error = `Could not retrieve the text for any of the ${billsFromYesterday.length} bills updated yesterday.`;
             debugLog.push(error);
             return { error: `${error}\n\nDebug Log:\n${debugLog.join('\n')}` };
        }
        
        const aiInput = billsWithText;
        debugLog.push("\n===== AI Prompt Input (JSON) =====");
        debugLog.push("The following JSON object will be provided to the AI for summarization:");
        debugLog.push(JSON.stringify(aiInput, null, 2));
        debugLog.push("==================================");
        
        const summarizeBillsPromptTemplate = `You are a parliamentary analyst. You will be given a JSON array of parliamentary bills from the Canadian Parliament that were updated yesterday.
For each bill, generate a concise and neutral summary. Combine these into a single, coherent report for the day.
If the text for a bill could not be retrieved, please note that in your summary for that specific bill.

Your output MUST be a single JSON object with a "summary" field containing the full report.

Input Bills:
{{jsonStringify this}}

Your JSON Output:
`;
        
        debugLog.push("\n===== AI Prompt Template =====");
        debugLog.push("This is the template the AI will use to render the final prompt:");
        debugLog.push(summarizeBillsPromptTemplate);
        debugLog.push("============================");

        console.log("===== Full Bill Summarization Debug Log =====");
        console.log(debugLog.join('\n'));
        console.log("==============================================");
        
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
