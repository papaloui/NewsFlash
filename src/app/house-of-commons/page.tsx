
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Landmark, Loader2, Search, BookOpen, Clock, Languages, User, FileText as FileTextIcon, ExternalLink, ScrollText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSectionSummary, getTranscriptSummary } from './actions';
import { HansardChat } from '@/components/app/hansard-chat';
import type { TranscriptChunk } from '@/ai/flows/summarize-hansard-transcript';


interface InterventionContent {
  type: 'text' | 'timestamp' | 'language';
  value: string;
}

interface Intervention {
  type: string | null;
  id: string | null;
  speaker?: string;
  content: InterventionContent[];
}

interface HansardData {
  meta: { [key:string]: string };
  interventions: Intervention[];
}

interface FullSummary {
  summary: string;
  topics: string[];
  billsReferenced: string[];
}


export default function HouseOfCommonsPage() {
  const [url, setUrl] = useState('https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML');
  const [data, setData] = useState<HansardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [fullSummary, setFullSummary] = useState<FullSummary | null>(null);
  const [isSummarizingFull, setIsSummarizingFull] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const handleLoad = async () => {
    setIsLoading(true);
    setData(null);
    setSummaries({});
    setFullSummary(null);
    try {
      const res = await fetch(`/api/hansard?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load Hansard data.');
      }
      const jsonData: HansardData = await res.json();
      if (!jsonData.interventions || jsonData.interventions.length === 0) {
        throw new Error("Parsing completed, but no interventions were found in the XML.");
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

  const getFullTranscriptText = () => {
    if (!data) return '';
    return data.interventions.map(i => {
      const speaker = i.speaker || 'Unnamed Speaker';
      const text = getTextFromContent(i.content);
      if (i.type === 'OrderOfBusiness' || i.type === 'SubjectOfBusiness') {
        return `\n--- ${text} ---\n`;
      }
      if (!text) return '';
      return `${speaker}:\n${text}`;
    }).join('\n\n');
  }

  const getFullTranscriptChunks = (): TranscriptChunk[] => {
    if (!data) return [];
    return data.interventions.map(i => {
      const speaker = i.speaker || 'Unnamed Speaker';
      const text = getTextFromContent(i.content);
      if (i.type === 'OrderOfBusiness' || i.type === 'SubjectOfBusiness') {
        return { speaker: 'Section Marker', text: `--- ${text} ---` };
      }
      return { speaker, text };
    }).filter(chunk => chunk.text.trim() !== '');
  };

  const handleSummarizeSection = async (intervention: Intervention) => {
    const sectionId = intervention.id || 'summary';
    if (!intervention.content) return;
    
    setSummarizingId(sectionId);
    const sectionText = getTextFromContent(intervention.content);
    
    try {
      const summary = await getSectionSummary(sectionText);
      setSummaries(prev => ({...prev, [sectionId]: summary}));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setSummaries(prev => ({...prev, [sectionId]: `Error: ${errorMessage}`}));
    } finally {
      setSummarizingId(null);
    }
  }

  const handleFullSummary = async () => {
    const transcriptChunks = getFullTranscriptChunks();
    if (transcriptChunks.length === 0) return;
    setIsSummarizingFull(true);
    setFullSummary(null);
    setSummaryError(null);

    try {
      const summaryResult = await getTranscriptSummary(transcriptChunks);
      setFullSummary(summaryResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setSummaryError(`Error generating summary: ${errorMessage}`);
    } finally {
      setIsSummarizingFull(false);
    }
  }


  const renderIntervention = (intervention: Intervention, idx: number) => {
    const isSectionHeading = intervention.type === 'OrderOfBusiness' || intervention.type === 'SubjectOfBusiness';
    const sectionId = intervention.id || `section-${idx}`;

    if (isSectionHeading) {
      const title = getTextFromContent(intervention.content);
      return (
        <Card key={sectionId} className="shadow-md bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5 text-primary" />
                {title}
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleSummarizeSection(intervention)}
                disabled={summarizingId === sectionId}
              >
                {summarizingId === sectionId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Summarize Section'}
              </Button>
            </CardTitle>
            <Badge variant="secondary" className="w-fit">{intervention.type}</Badge>
          </CardHeader>
          {summaries[sectionId] && (
            <CardContent>
              <p className="text-sm text-muted-foreground italic">{summaries[sectionId]}</p>
            </CardContent>
          )}
        </Card>
      );
    }

    if (!intervention.speaker || intervention.content.length === 0 || !getTextFromContent(intervention.content)) return null;

    return (
      <Card key={intervention.id || idx} className="shadow-sm ml-4">
        <CardHeader className='pb-3'>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
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
  
  const filteredInterventions = data?.interventions.filter(i => {
      if (!searchQuery) return true;
      const fullText = getTextFromContent(i.content).toLowerCase();
      const speakerName = i.speaker?.toLowerCase() || '';
      return fullText.includes(searchQuery.toLowerCase()) || speakerName.includes(searchQuery.toLowerCase());
  }) || [];


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
                 <CardFooter>
                    <Button onClick={handleFullSummary} disabled={isSummarizingFull}>
                        {isSummarizingFull ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScrollText className="mr-2 h-4 w-4" />}
                        Generate Full Summary
                    </Button>
                </CardFooter>
            </Card>
        )}

        {isSummarizingFull && (
            <div className="mt-6 flex justify-center items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating full summary... This is a slow process designed for overnight batching and may take several minutes.</span>
            </div>
        )}

        {summaryError && (
          <Card className="mt-6 border-destructive">
            <CardHeader>
              <CardTitle className='text-destructive'>Summary Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive/90">{summaryError}</p>
            </CardContent>
          </Card>
        )}

        {fullSummary && (
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Full Debate Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className='space-y-3'>
                      <h3 className="font-semibold">Topics Discussed</h3>
                      <div className="flex flex-wrap gap-2">
                        {fullSummary.topics.map((topic, index) => (
                          <Badge key={index} variant="secondary">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                     <div className='space-y-3'>
                      <h3 className="font-semibold">Bills Referenced</h3>
                      <div className="flex flex-wrap gap-2">
                        {fullSummary.billsReferenced?.map((bill, index) => (
                          <Badge key={index} variant="outline">{bill}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mt-4 mb-2">Summary</h3>
                      <p className="whitespace-pre-wrap font-body text-sm leading-relaxed">{fullSummary.summary}</p>
                    </div>
                </CardContent>
            </Card>
        )}
        
        {fullSummary && data && (
          <HansardChat transcript={getFullTranscriptText()} summary={fullSummary.summary} />
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
                  <pre className="whitespace-pre-wrap font-body text-sm bg-muted p-4 rounded-md max-h-[400px] overflow-auto">{getFullTranscriptText()}</pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={`Search ${data.interventions.length} interventions...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                />
            </div>
            
            <div className="space-y-4">
                {filteredInterventions.length > 0 ? filteredInterventions.map(renderIntervention) : (
                     <div className="text-center py-10">
                        <p className="text-muted-foreground">No interventions match your search query.</p>
                    </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
