import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

interface Intervention {
  type: string | null;
  id: string | null;
  speaker?: string;
  affiliation?: string;
  content: { type: string; value: string; }[];
}

interface HansardData {
  meta: { [key: string]: string | undefined };
  interventions: Intervention[];
}


export async function GET(req: NextRequest) {
  const url =
    req.nextUrl.searchParams.get("url") ||
    "https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML";

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch XML: ${res.status}` },
        { status: 500 }
      );
    }
    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
      textNodeName: "#text"
    });
    const obj = parser.parse(xml);

    const hansardDoc = obj.Hansard;

    // 1. Extract Document Info
    const meta: { [key: string]: any } = {};
    if (hansardDoc.ExtractedInformation?.ExtractedItem) {
        const items = Array.isArray(hansardDoc.ExtractedInformation.ExtractedItem) 
            ? hansardDoc.ExtractedInformation.ExtractedItem 
            : [hansardDoc.ExtractedInformation.ExtractedItem];

        items.forEach((item: any) => {
            if(item['@_Name'] && item['#text']) {
                const key = item['@_Name'].replace(/\s/g, '');
                meta[key] = item['#text'];
            }
        });
    }
    meta.documentTitle = hansardDoc.DocumentTitle;


    // 2. Extract Interventions
    const interventions: Intervention[] = [];
    const interventionNodes = hansardDoc.HansardBody?.Intervention 
        ? (Array.isArray(hansardDoc.HansardBody.Intervention) ? hansardDoc.HansardBody.Intervention : [hansardDoc.HansardBody.Intervention])
        : [];

    interventionNodes.forEach((node: any) => {
        const intervention: Intervention = {
            type: node['@_Type'] || null,
            id: node['@_id'] || null,
            content: []
        };

        // Extract speaker and affiliation
        if (node.PersonSpeaking) {
            const personNode = node.PersonSpeaking;
            intervention.speaker = personNode['#text']?.replace(':', '').trim();
            if (personNode.Affiliation) {
                intervention.affiliation = personNode.Affiliation['#text'];
            }
        }
        
        // Extract content
        if (node.Content) {
            const contentKeys = Object.keys(node.Content);
            contentKeys.forEach(key => {
                const contentItems = Array.isArray(node.Content[key]) ? node.Content[key] : [node.Content[key]];
                contentItems.forEach((item: any) => {
                    const text = item['#text'] || (typeof item === 'string' ? item : '');
                    if (key === 'ParaText') {
                        intervention.content.push({ type: 'text', value: text });
                    } else if (key === 'FloorLanguage') {
                        intervention.content.push({ type: 'language', value: text });
                    } else if (key === 'Timestamp') {
                        intervention.content.push({ type: 'timestamp', value: text });
                    }
                });
            });
        }
        
        interventions.push(intervention);
    });

    const responseData: HansardData = { meta, interventions };

    return NextResponse.json(responseData);

  } catch (err: any) {
    console.error("Error parsing Hansard XML:", err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
