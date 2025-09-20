
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
  content: InterventionContent[];
}

interface HansardData {
  meta: { [key: string]: string | undefined };
  interventions: Intervention[];
}

// Helper to recursively find all objects with a specific key
function findAllByKey(obj: any, keyToFind: string): any[] {
  let results: any[] = [];
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  for (const key in obj) {
    if (key === keyToFind) {
      if (Array.isArray(obj[key])) {
        results = results.concat(obj[key]);
      } else {
        results.push(obj[key]);
      }
    } else if (typeof obj[key] === 'object') {
      results = results.concat(findAllByKey(obj[key], keyToFind));
    }
  }
  return results;
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
      textNodeName: "#text",
      isArray: (name, jpath, isLeafNode, isAttribute) => {
        // Force these elements to be arrays, even if there's only one.
        const arrayElements = new Set(['ExtractedItem', 'Intervention', 'ParaText', 'FloorLanguage', 'Timestamp']);
        return arrayElements.has(name);
      }
    });
    const obj = parser.parse(xml);
    const hansardDoc = obj.Hansard;

    // 1. Extract Document Info
    const meta: { [key: string]: any } = {};
    if (hansardDoc.ExtractedInformation?.ExtractedItem) {
        hansardDoc.ExtractedInformation.ExtractedItem.forEach((item: any) => {
            if(item['@_Name'] && item['#text']) {
                const key = item['@_Name'].replace(/\s/g, '');
                meta[key] = item['#text'];
            }
        });
    }

    meta.documentTitle = (typeof hansardDoc.DocumentTitle === 'object' && hansardDoc.DocumentTitle !== null)
      ? (hansardDoc.DocumentTitle.DocumentName?.['#text'] || hansardDoc.DocumentTitle.DocumentName || hansardDoc.DocumentTitle['#text'])
      : hansardDoc.DocumentTitle;
      
    if (typeof meta.documentTitle === 'object') {
       meta.documentTitle = meta.documentTitle?.['#text'] || JSON.stringify(meta.documentTitle);
    }


    // 2. Extract All Interventions
    const interventionNodes = findAllByKey(hansardDoc, 'Intervention');
    const interventions: Intervention[] = interventionNodes.map((item: any) => {
        const intervention: Intervention = {
            type: item['@_Type'] || 'Intervention',
            id: item['@_id'] || null,
            content: []
        };

        if (item.PersonSpeaking?.Affiliation) {
            const speakerName = item.PersonSpeaking.Affiliation['#text'];
            intervention.speaker = speakerName?.trim() || 'Unknown Speaker';
        } else if (item.PersonSpeaking) {
             const speakerName = item.PersonSpeaking['#text']?.replace(':', '').trim();
             intervention.speaker = speakerName || 'Unknown Speaker';
        }
        
        if (item.Content) {
            const contentItems = item.Content.ParaText || [];
            contentItems.forEach((cItem: any) => {
                const text = cItem['#text'] || (typeof cItem === 'string' ? cItem : '');
                if (text) {
                    intervention.content.push({ type: 'text', value: text });
                }
            });
            
            const langItems = item.Content.FloorLanguage || [];
            langItems.forEach((cItem: any) => {
                 const text = cItem['#text'] || (typeof cItem === 'string' ? cItem : '');
                 if(text) intervention.content.push({ type: 'language', value: `[${text}]` });
            });

            const timeItems = item.Content.Timestamp || [];
            timeItems.forEach((cItem: any) => {
                 const text = cItem['#text'] || (typeof cItem === 'string' ? cItem : '');
                 if(text) intervention.content.push({ type: 'timestamp', value: text });
            });
        }
        return intervention;
    }).filter(i => i.content.length > 0);


    const responseData: HansardData = { meta, interventions };

    return NextResponse.json(responseData);

  } catch (err: any) {
    console.error("Error parsing Hansard XML:", err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
