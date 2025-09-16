import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

// Helper to reliably get text from a node, however it's structured.
function getTextFromNode(node: any): string {
    if (node == null) return '';
    // If the node is just a string, return it.
    if (typeof node === 'string') return node.trim();
    // If it's an array, process each item.
    if (Array.isArray(node)) return node.map(getTextFromNode).join('\n\n').trim();
    
    // If it's an object, it might have a '#text' property for its content.
    if (typeof node === 'object' && node['#text']) {
        return String(node['#text']).trim();
    }

    // Fallback for more complex nested tags within a paragraph.
    let text = '';
    if (typeof node === 'object') {
        for (const key of Object.keys(node)) {
            text += ' ' + getTextFromNode(node[key]);
        }
    }
    
    return text.trim().replace(/\s+/g, ' ');
}

// Tolerant traversal function to find and extract speeches from the parsed XML object.
function extractSpeechesFromParsedXML(obj: any): any[] {
    const speeches: any[] = [];
    
    try {
        const hansard = obj.HansardDocument;
        if (!hansard) return [];

        const debateSections = Array.isArray(hansard.debateSection) ? hansard.debateSection : [hansard.debateSection].filter(Boolean);

        for (const ds of debateSections) {
            const debates = Array.isArray(ds.debate) ? ds.debate : [ds.debate].filter(Boolean);
            
            for (const debate of debates) {
                if (!debate.speech) continue;
                const speechList = Array.isArray(debate.speech) ? debate.speech : [debate.speech];
                
                for (const s of speechList) {
                    const speakerNode = s.speaker;
                    const speaker = (typeof speakerNode === 'string' ? speakerNode : (speakerNode?.['#text'] || 'Unknown Speaker')).trim();
                    const timestamp = s["@_time"] || null;
                    
                    let text = '';
                    if (s.p) {
                        const paragraphs = Array.isArray(s.p) ? s.p : [s.p];
                        text = paragraphs.map(getTextFromNode).filter(Boolean).join('\n\n');
                    }

                    if (text) {
                        speeches.push({ speaker, timestamp, text });
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error traversing XML structure:', e);
        // Return whatever was found, even if traversal failed partway through.
        return speeches;
    }

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
      attributeNamePrefix: '@_',
      textNodeName: "#text",
      trimValues: true,
    });
    const parsedObj = parser.parse(xmlText);
    
    const speeches = extractSpeechesFromParsedXML(parsedObj);

    if (speeches.length === 0) {
        return NextResponse.json({ 
            error: 'Could not parse any speeches from the provided XML.',
        }, { status: 500 });
    }

    return NextResponse.json({ speeches });

  } catch (error) {
    console.error("Error in /api/hansard:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
