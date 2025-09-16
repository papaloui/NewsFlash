'use server';

import { XMLParser } from 'fast-xml-parser';

/**
 * @fileoverview Service for fetching and parsing House of Commons debates from XML.
 */

interface Speech {
    speaker: string;
    content: string;
}

// Tolerant walker to extract text from different node structures.
function getTextFromNode(node: any): string {
    if (node == null) return '';
    if (typeof node === 'string') return node.trim();
    if (Array.isArray(node)) return node.map(getTextFromNode).join(' ').trim();
    
    let text = '';
    if (typeof node === 'object') {
        for (const key of Object.keys(node)) {
            // #text is a common property for text content in fast-xml-parser
            if (key === '#text') {
                text += ' ' + node[key];
            } else if (key.toLowerCase() === 'p' || key.toLowerCase() === 'para') {
                text += ' ' + getTextFromNode(node[key]);
            }
        }
    }
    return text.trim();
}


function extractSpeechesFromParsedXML(obj: any): Speech[] {
    const speeches: Speech[] = [];

    // The root object often contains nested structures leading to the debates.
    // We can recursively search for 'Intervention' which seems to be the container for each speech.
    function findInterventions(currentObj: any) {
        if (!currentObj || typeof currentObj !== 'object') return;

        const key = 'Intervention';
        if (key in currentObj) {
            const interventions = Array.isArray(currentObj[key]) ? currentObj[key] : [currentObj[key]];
            
            for (const item of interventions) {
                let speaker = 'Unknown Speaker';
                // The speaker's name can be in various tags.
                const speakerNode = item.PersonSpeaking || item.persontitle || item.PersonTitle;
                if (speakerNode && typeof speakerNode === 'object' && speakerNode['#text']) {
                    speaker = speakerNode['#text'].replace(/:$/, '').trim();
                } else if (typeof speakerNode === 'string') {
                    speaker = speakerNode.replace(/:$/, '').trim();
                }
                
                const content = getTextFromNode(item);

                if (content) {
                    speeches.push({ speaker, content });
                }
            }
        } else {
            // Recurse through the object to find interventions
            for (const k of Object.keys(currentObj)) {
                findInterventions(currentObj[k]);
            }
        }
    }

    findInterventions(obj);
    return speeches;
}


/**
 * Fetches the transcript content for a specific House of Commons debate from an XML source.
 * @returns An object containing the transcript, the source URL, and the raw XML response for debugging.
 */
export async function getHansardContent(): Promise<{transcript: string; url: string; rawResponse: string;}> {
    
    const xmlUrl = 'https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML';
    console.log(`Fetching Hansard from XML source: ${xmlUrl}`);

    let rawResponse = '';

    try {
        const response = await fetch(xmlUrl, {
             headers: {
                'User-Agent': 'NewsFlash-App/1.0 (contact@example.com)'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch Hansard XML (status: ${response.status}). Response: ${errorText}`);
        }

        const xmlText = await response.text();
        rawResponse = xmlText;

        const parser = new XMLParser({
            ignoreAttributes: false,
            // Keep text nodes, which is where content often lives.
            textNodeName: "#text"
        });
        const parsedObj = parser.parse(xmlText);

        const speeches = extractSpeechesFromParsedXML(parsedObj);
        
        if (speeches.length === 0) {
            return {
                transcript: `No debates could be parsed from the XML at ${xmlUrl}.`,
                url: xmlUrl,
                rawResponse
            };
        }

        const fullTranscript = speeches.map(s => `**${s.speaker}**: ${s.content}`).join('\n\n');

        return { transcript: fullTranscript, url: xmlUrl, rawResponse };

    } catch (error) {
        console.error('Error fetching or parsing Hansard XML content:', error);
        const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred while fetching the Hansard transcript.';
        return { transcript: errorMessage, url: xmlUrl, rawResponse: rawResponse || `Fetching failed: ${errorMessage}` };
    }
}
