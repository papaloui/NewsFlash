
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
      textNodeName: "#text",
      isArray: (name, jpath, isLeafNode, isAttribute) => {
        // Force these elements to be arrays, even if there's only one.
        const arrayElements = new Set(['ExtractedItem', 'OrderOfBusiness', 'SubjectOfBusiness', 'Intervention', 'ParaText', 'FloorLanguage', 'Timestamp']);
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


    // 2. Extract Sections and Interventions
    const sections: Section[] = [];
    
    function parseInterventions(interventionNodes: any[]): Intervention[] {
        if (!interventionNodes) return [];
        return interventionNodes.map((item: any) => {
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
                     if(text) intervention.content.push({ type: 'language', value: text });
                });

                const timeItems = item.Content.Timestamp || [];
                timeItems.forEach((cItem: any) => {
                     const text = cItem['#text'] || (typeof cItem === 'string' ? cItem : '');
                     if(text) intervention.content.push({ type: 'timestamp', value: text });
                });
            }
            return intervention;
        }).filter(i => i.content.length > 0);
    }

    const hansardBody = hansardDoc.HansardBody;

    const processNode = (node: any) => {
        if (node.OrderOfBusiness) {
            node.OrderOfBusiness.forEach((oob: any) => {
                const section: Section = {
                    type: 'OrderOfBusiness',
                    title: oob.OrderOfBusinessTitle || 'Order of Business',
                    content: oob.Content?.ParaText?.[0]?.['#text'] || '',
                    interventions: []
                };

                // Process Subjects of Business within the Order of Business
                if (oob.SubjectOfBusiness) {
                    oob.SubjectOfBusiness.forEach((sob: any) => {
                         const subjectSection: Section = {
                             type: 'SubjectOfBusiness',
                             title: sob.SubjectOfBusinessTitle || 'Subject of Business',
                             content: sob.Content?.ParaText?.[0]?.['#text'] || '',
                             interventions: sob.Intervention ? parseInterventions(sob.Intervention) : []
                         };
                         if(subjectSection.interventions.length > 0) {
                            sections.push(subjectSection);
                         }
                    });
                }
                
                // Also capture interventions directly under OrderOfBusiness if any
                if(oob.Intervention) {
                    section.interventions = parseInterventions(oob.Intervention);
                }

                if (section.interventions.length > 0 || sections.find(s => s.type === 'SubjectOfBusiness')) {
                     // Only add the OOB if it has direct interventions or nested subjects that have interventions
                     const hasNestedContent = sections.some(s => oob.SubjectOfBusiness?.some((sob:any) => sob.SubjectOfBusinessTitle === s.title));
                     if(section.interventions.length > 0 || hasNestedContent) {
                        // Check if we should merge with last section or add new
                        const lastSection = sections[sections.length - 1];
                        if (lastSection && lastSection.type === 'OrderOfBusiness' && !lastSection.interventions.length && !hasNestedContent) {
                            sections[sections.length-1] = section; // Replace placeholder
                        } else if(section.title) {
                            sections.unshift(section);
                        }
                     }
                }
            });
        }
        
        // Capture interventions at the root of HansardBody, outside of any OOB/SOB
        if (hansardBody.Intervention) {
            sections.push({
                type: 'Debate',
                title: 'Main Debate',
                content: '',
                interventions: parseInterventions(hansardBody.Intervention)
            });
        }
    }
    
    processNode(hansardBody);

    const responseData: HansardData = { meta, sections };

    return NextResponse.json(responseData);

  } catch (err: any) {
    console.error("Error parsing Hansard XML:", err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
