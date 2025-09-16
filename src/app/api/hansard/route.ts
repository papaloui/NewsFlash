import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

// Helper to reliably get text from a node, however it's structured.
function getTextFromNode(node: any): string {
    if (node == null) return '';
    if (typeof node === 'string') return node.trim();
    if (Array.isArray(node)) return node.map(getTextFromNode).join(' ').trim();
    
    let text = '';
    if (typeof node === 'object') {
        for (const key of Object.keys(node)) {
            if (key === '#text') {
                text += ' ' + node[key];
            } else if (key.toLowerCase() === 'p' || key.toLowerCase() === 'para') {
                text += ' ' + getTextFromNode(node[key]);
            }
        }
    }
    return text.trim();
}

// Tolerant traversal function to find and extract speeches from the parsed XML object.
function extractSpeechesFromParsedXML(obj: any): any[] {
    const speeches: any[] = [];

    function findInterventions(currentObj: any) {
        if (!currentObj || typeof currentObj !== 'object') return;

        // "Intervention" seems to be the most common tag for a speech block.
        const key = 'Intervention';
        if (key in currentObj) {
            const interventions = Array.isArray(currentObj[key]) ? currentObj[key] : [currentObj[key]];
            
            for (const item of interventions) {
                let speaker = 'Unknown Speaker';
                // The speaker's name can be in various tags or attributes.
                const personSpeakingNode = item.PersonSpeaking || item.persontitle || item.PersonTitle;
                if (personSpeakingNode && typeof personSpeakingNode === 'object' && personSpeakingNode['#text']) {
                    speaker = personSpeakingNode['#text'].replace(/:$/, '').trim();
                } else if (typeof personSpeakingNode === 'string') {
                    speaker = personSpeakingNode.replace(/:$/, '').trim();
                }

                // The actual content is usually within <p> tags inside the intervention.
                const content = getTextFromNode(item.Content);
                
                if (content) {
                    speeches.push({
                        speaker,
                        text: content
                    });
                }
            }
        } else {
            // If no "Intervention" found at this level, recurse deeper into the object.
            for (const k of Object.keys(currentObj)) {
                findInterventions(currentObj[k]);
            }
        }
    }

    findInterventions(obj);
    return speeches;
}


export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'NewsFlash-App/1.0 (contact@example.com)'
        }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch XML: ${response.statusText}` }, { status: response.status });
    }
    
    const xmlText = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      textNodeName: "#text"
    });
    const parsedObj = parser.parse(xmlText);
    
    const speeches = extractSpeechesFromParsedXML(parsedObj);

    if (speeches.length === 0) {
        return NextResponse.json({ error: 'Could not parse any speeches from the provided XML.' }, { status: 500 });
    }

    return NextResponse.json({ speeches });

  } catch (error) {
    console.error("Error in /api/hansard:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
