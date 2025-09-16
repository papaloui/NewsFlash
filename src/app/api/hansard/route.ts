
import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

interface InterventionContent {
  type: string;
  value: string;
}

interface Intervention {
  type: string | null;
  id: string | null;
  speaker?: string;
  affiliation?: string;
  content: InterventionContent[];
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
    meta.documentTitle = (typeof hansardDoc.DocumentTitle === 'object' && hansardDoc.DocumentTitle !== null) 
      ? (hansardDoc.DocumentTitle.DocumentName || hansardDoc.DocumentTitle['#text'])
      : hansardDoc.DocumentTitle;


    // 2. Extract Interventions
    const interventions: Intervention[] = [];
    
    // Recursive function to find all 'Intervention' nodes
    function findInterventions(node: any) {
        if (!node || typeof node !== 'object') {
            return;
        }

        if (Array.isArray(node)) {
            node.forEach(item => findInterventions(item));
            return;
        }

        for (const key in node) {
            if (key === 'Intervention') {
                const interventionItems = Array.isArray(node[key]) ? node[key] : [node[key]];
                interventionItems.forEach((item: any) => {
                     const intervention: Intervention = {
                        type: item['@_Type'] || null,
                        id: item['@_id'] || null,
                        content: []
                    };

                    // Extract speaker and affiliation
                    if (item.PersonSpeaking) {
                        const personNode = item.PersonSpeaking;
                        // The speaker name is the text node within PersonSpeaking, excluding the Affiliation part.
                        let fullText = personNode['#text'] || '';
                        let affiliationText = personNode.Affiliation?.['#text'] || '';
                        let speakerName = fullText.replace(affiliationText, '').replace(':', '').trim();
                        intervention.speaker = speakerName;
                    }
                    
                    // Extract content
                    if (item.Content) {
                        const contentKeys = Object.keys(item.Content);
                        contentKeys.forEach(contentKey => {
                            const contentItems = Array.isArray(item.Content[contentKey]) ? item.Content[contentKey] : [item.Content[contentKey]];
                            contentItems.forEach((cItem: any) => {
                                const text = cItem['#text'] || (typeof cItem === 'string' ? cItem : '');
                                if (contentKey === 'ParaText' && text) {
                                    intervention.content.push({ type: 'text', value: text });
                                } else if (contentKey === 'FloorLanguage' && text) {
                                    intervention.content.push({ type: 'language', value: text });
                                } else if (contentKey === 'Timestamp' && text) {
                                    intervention.content.push({ type: 'timestamp', value: text });
                                }
                            });
                        });
                    }
                    
                    if(intervention.content.length > 0) {
                        interventions.push(intervention);
                    }
                });
            } else if (key === 'OrderOfBusiness' || key === 'SubjectOfBusiness') {
                const businessItem = Array.isArray(node[key]) ? node[key][0] : node[key];
                 if(businessItem) {
                     const title = businessItem[`${key}Title`];
                     const textContent = businessItem.Content?.ParaText?.['#text'] || businessItem.Content?.ParaText || '';
                     if(title || textContent) {
                        interventions.push({
                            type: key,
                            id: null,
                            content: [
                                {type: 'title', value: title},
                                {type: 'text', value: textContent}
                            ]
                        });
                     }
                 }
            } else if (typeof node[key] === 'object') {
                findInterventions(node[key]);
            }
        }
    }
    
    findInterventions(hansardDoc.HansardBody);


    const responseData: HansardData = { meta, interventions };

    return NextResponse.json(responseData);

  } catch (err: any) {
    console.error("Error parsing Hansard XML:", err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
