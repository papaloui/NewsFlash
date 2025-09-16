
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Landmark, Loader2, Search, BookOpen, Clock, Languages, User, FileText as FileTextIcon, ExternalLink, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSectionSummary } from './actions';

interface InterventionContent {
  type: 'text' | 'timestamp' | 'language' | 'title';
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
    summary?: string;
    isSummarizing?: boolean;
}

interface HansardData {
  meta: { [key:string]: string };
  sections: Section[];
}


export default function HouseOfCommonsPage() {
  const [url, setUrl] = useState('https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML');
  const [data, setData] = useState<HansardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const handleLoad = async () => {
    setIsLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/hansard?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load Hansard data.');
      }
      const jsonData: HansardData = await res.json();
      if (!jsonData.sections || jsonData.sections.length === 0) {
        console.error("Parsed data but no sections found", jsonData);
        throw new Error("Parsing completed, but no sections were found in the XML.");
      }
      setData(jsonData);

    } catch (error) {
      console.error('Failed to get Hansard data:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Could not load data: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getTextFromContent = (content: InterventionContent[]) => {
    return content.filter(c => c.type === 'text').map(c => c.value).join(' ');
  };

  const getFullTranscript = () => {
    return data?.sections.map(section => {
      const sectionTitle = `${section.title}\n-----------------\n`;
      const interventionsText = section.interventions.map(i => {
        const speaker = i.speaker || 'Unnamed Speaker';
        const text = getTextFromContent(i.content);
        return `${speaker}:\n${text}`;
      }).join('\n\n');
      return sectionTitle + interventionsText;
    }).join('\n\n\n') || '';
  };
  
  const handleSummarizeSection = async (sectionIndex: number) => {
    if (!data) return;

    const section = data.sections[sectionIndex];
    // Collect all text from the section's content and its interventions for a comprehensive summary
    const sectionText = [
        section.content,
        ...section.interventions.map(i => `${i.speaker}: ${getTextFromContent(i.content)}`)
    ].join('\n\n');

    
    setData(prev => {
        if (!prev) return null;
        const newSections = [...prev.sections];
        newSections[sectionIndex] = { ...newSections[sectionIndex], isSummarizing: true };
        return { ...prev, sections: newSections };
    });

    try {
        const summary = await getSectionSummary(sectionText);
        setData(prev => {
            if (!prev) return null;
            const newSections = [...prev.sections];
            newSections[sectionIndex] = { ...newSections[sectionIndex], summary: summary, isSummarizing: false };
            return { ...prev, sections: newSections };
        });
    } catch (error) {
         toast({ variant: 'destructive', title: 'Summarization Failed' });
         setData(prev => {
            if (!prev) return null;
            const newSections = [...prev.sections];
            newSections[sectionIndex] = { ...newSections[sectionIndex], isSummarizing: false };
            return { ...prev, sections: newSections };
        });
    }
  };

  const renderIntervention = (intervention: Intervention, idx: number) => {
    // Only render items that are actual interventions with a speaker and content
    if (!intervention.speaker || intervention.content.length === 0) return null;

    return (
        <Card key={intervention.id || idx} className="shadow-sm mt-4">
        <CardHeader className='pb-3'>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {intervention.speaker}
          </CardTitle>
          {intervention.type && intervention.type !== 'Intervention' && <Badge variant="secondary" className="w-fit mt-1">{intervention.type}</Badge>}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {intervention.content.map((item, index) => {
              if (item.type === 'text') {
                return <p key={index} className="whitespace-pre-wrap font-body text-sm leading-relaxed">{item.value}</p>
              }
              if (item.type === 'timestamp') {
                return <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground font-mono"> <Clock className="h-3 w-3" /> {item.value} </div>
              }
              if (item.type === 'language') {
                 return <div key={index} className="flex items-center gap-2 text-xs text-blue-600 italic"> <Languages className="h-3 w-3" /> {item.value} </div>
              }
              return null;
            })}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Filter sections and their interventions based on search query
  const filteredSections = data?.sections.map(section => {
      const filteredInterventions = section.interventions.filter(i => {
          const fullText = getTextFromContent(i.content).toLowerCase();
          const speakerName = i.speaker?.toLowerCase() || '';
          const query = searchQuery.toLowerCase();
          return fullText.includes(query) || speakerName.includes(query);
      });

      // If the section title matches or it has matching interventions, keep it
      if (section.title.toLowerCase().includes(searchQuery.toLowerCase()) || filteredInterventions.length > 0) {
          return { ...section, interventions: filteredInterventions };
      }
      return null;
  }).filter((section): section is Section => section !== null) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark />
              House of Commons Debates
            </CardTitle>
            <CardDescription>
              Fetch and parse transcripts from a Hansard XML URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter Hansard XML URL..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={handleLoad} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                Load Transcript
              </Button>
            </div>
             <p className="text-xs text-muted-foreground">
                Example: <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{url} <ExternalLink className="inline-block h-3 w-3" /></a>
            </p>
          </CardContent>
        </Card>
        
        {data && (
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Debate Information</CardTitle>
                    <CardDescription>{data.meta.documentTitle}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <p><span className="font-semibold">Date:</span> {data.meta.Date}</p>
                    <p><span className="font-semibold">Parliament:</span> {data.meta.ParliamentNumber}</p>
                    <p><span className="font-semibold">Session:</span> {data.meta.SessionNumber}</p>
                    <p><span className="font-semibold">Volume:</span> {data.meta.VolumeNumber}</p>
                    <p><span className="font-semibold">Number:</span> {data.meta.NumberNumber}</p>
                </CardContent>
            </Card>
        )}
        
        {isLoading && (
            <div className="mt-6 flex justify-center items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Fetching and parsing transcript...</span>
            </div>
        )}

        {data && (
          <div className="mt-6 space-y-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="full-transcript">
                <AccordionTrigger>View Full Transcript</AccordionTrigger>
                <AccordionContent>
                  <pre className="whitespace-pre-wrap font-body text-sm bg-muted p-4 rounded-md max-h-[400px] overflow-auto">{getFullTranscript()}</pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={`Search ${data.sections.reduce((acc, s) => acc + s.interventions.length, 0)} interventions...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                />
            </div>
            
            <div className="space-y-8">
                {filteredSections.length > 0 ? filteredSections.map((section, sectionIdx) => (
                    <div key={sectionIdx} className="py-4 my-4 border-y-2 border-primary/20">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-xl font-semibold text-primary">{section.title}</h3>
                             <Button size="sm" variant="outline" onClick={() => handleSummarizeSection(sectionIdx)} disabled={section.isSummarizing}>
                                {section.isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Summarize Section
                             </Button>
                        </div>
                        {section.summary && (
                          <Card className="mb-4 bg-primary/5">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-primary/90">{section.summary}</p>
                            </CardContent>
                          </Card>
                        )}
                        {section.content && <p className="text-muted-foreground italic mb-4">{section.content}</p>}

                        <div className="pl-4 border-l-2 border-primary/20 space-y-4">
                            {section.interventions.length > 0 ? section.interventions.map(renderIntervention) : (
                                <p className="text-sm text-muted-foreground">No debate content for this section.</p>
                            )}
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">No sections match your search query.</p>
                    </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
