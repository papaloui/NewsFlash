
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

interface Section {
    type: 'OrderOfBusiness' | 'SubjectOfBusiness' | 'Debate';
    title: string;
    content: string;
    interventions: Intervention[];
}

interface HansardData {
  meta: { [key: string]: string | undefined };
  sections: Section[];
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
      ? (hansardDoc.DocumentTitle.DocumentName?.['#text'] || hansardDoc.DocumentTitle.DocumentName || hansardDoc.DocumentTitle['#text'])
      : hansardDoc.DocumentTitle;


    // 2. Extract Sections and Interventions
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    
    // Recursive function to process all nodes
    function processNodes(node: any) {
        if (!node || typeof node !== 'object') {
            return;
        }

        if (Array.isArray(node)) {
            node.forEach(item => processNodes(item));
            return;
        }
        
        const isOrderOfBusiness = node.OrderOfBusinessTitle && node.Content;
        const isSubjectOfBusiness = node.SubjectOfBusinessTitle && node.Content;

        if (isOrderOfBusiness || isSubjectOfBusiness) {
            // Start a new section
            const businessItem = node;
            const title = businessItem.OrderOfBusinessTitle || businessItem.SubjectOfBusinessTitle;
            const textContent = businessItem.Content?.ParaText?.['#text'] || businessItem.Content?.ParaText || '';
            
            if (title || textContent) {
                if (currentSection) sections.push(currentSection); // push previous section
                
                currentSection = {
                    type: isOrderOfBusiness ? 'OrderOfBusiness' : 'SubjectOfBusiness',
                    title: title || 'Untitled Section',
                    content: textContent,
                    interventions: []
                };
            }
        }
        
        if (node.Intervention) {
            if (!currentSection) {
                 // Create a default "Debate" section if we encounter interventions first
                 currentSection = { type: 'Debate', title: 'Main Debate', content: '', interventions: [] };
            }
            const interventionItems = Array.isArray(node.Intervention) ? node.Intervention : [node.Intervention];
            interventionItems.forEach((item: any) => {
                 const intervention: Intervention = {
                    type: item['@_Type'] || 'Intervention',
                    id: item['@_id'] || null,
                    content: []
                };

                if (item.PersonSpeaking) {
                    const personNode = item.PersonSpeaking;
                    let fullText = personNode['#text'] || '';
                    let affiliationText = personNode.Affiliation?.['#text'] || '';
                    let speakerName = fullText.replace(affiliationText, '').replace(':', '').trim();
                    intervention.speaker = speakerName;
                }
                
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
                
                if (intervention.content.length > 0 && currentSection) {
                    currentSection.interventions.push(intervention);
                }
            });
        }
        
        // Always recurse deeper
        for (const key in node) {
            // Avoid re-processing nodes we've handled
            if (key !== 'OrderOfBusiness' && key !== 'SubjectOfBusiness' && key !== 'Intervention') {
                if (typeof node[key] === 'object') {
                    processNodes(node[key]);
                }
            }
        }
    }
    
    // Start processing from the body
    processNodes(hansardDoc.HansardBody);
    
    // Push the last section if it exists
    if (currentSection) {
        sections.push(currentSection);
    }

    const responseData: HansardData = { meta, sections };

    return NextResponse.json(responseData);

  } catch (err: any) {
    console.error("Error parsing Hansard XML:", err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
