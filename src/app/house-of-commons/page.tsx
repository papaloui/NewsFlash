
'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Landmark, Loader2, Search, BookOpen, Clock, Languages, User, FileText as FileTextIcon, ExternalLink, ScrollText, Bug, Hourglass, CalendarDays, Link as LinkIcon, FileCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { startTranscriptSummary, checkSummaryJob, getSittingDates, getHansardLinkForDate, getHansardXmlLink } from './actions';
import { HansardChat } from '@/components/app/hansard-chat';


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

interface DebugInfo {
    chunkSummaries: string[];
    finalPrompt: string;
}

interface FullSummary {
  summary: string;
  topics: string[];
  billsReferenced: string[];
  debugInfo?: DebugInfo;
}

interface SittingDateCheck {
    isLoading: boolean;
    error: string | null;
    allDates: string[];
    wasSitting: boolean | null;
    hansardUrl: string | null;
    isUrlLoading: boolean;
    isXmlLoading: boolean;
}

// Helper to introduce a delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export default function HouseOfCommonsPage() {
  const [url, setUrl] = useState('https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML');
  const [data, setData] = useState<HansardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [fullSummary, setFullSummary] = useState<FullSummary | null>(null);
  const [isSummarizingFull, setIsSummarizingFull] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [sittingDateCheck, setSittingDateCheck] = useState<SittingDateCheck>({
    isLoading: false,
    error: null,
    allDates: [],
    wasSitting: null,
    hansardUrl: null,
    isUrlLoading: false,
    isXmlLoading: false,
  });

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleLoad = async () => {
    setIsLoading(true);
    setData(null);
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

  const pollJobStatus = (id: string) => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const statusResult = await checkSummaryJob(id);
        if (statusResult.status === 'completed') {
          setFullSummary(statusResult.result!);
          setIsSummarizingFull(false);
          setJobId(null);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        } else if (statusResult.status === 'error') {
          setSummaryError(`Error generating summary: ${statusResult.error}`);
          setIsSummarizingFull(false);
          setJobId(null);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        }
        // If 'pending', do nothing and wait for the next interval
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while polling.';
        setSummaryError(errorMessage);
        setIsSummarizingFull(false);
        setJobId(null);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleFullSummary = async () => {
    const transcriptText = getFullTranscriptText();
    if (transcriptText.length === 0) return;
    
    setIsSummarizingFull(true);
    setFullSummary(null);
    setSummaryError(null);
    setJobId(null);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    try {
      const { jobId: newJobId } = await startTranscriptSummary(transcriptText);
      setJobId(newJobId);
      pollJobStatus(newJobId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setSummaryError(`Error starting summary job: ${errorMessage}`);
      setIsSummarizingFull(false);
    }
  }

   const handleSittingDateCheck = async () => {
    setSittingDateCheck({ isLoading: true, error: null, allDates: [], wasSitting: null, hansardUrl: null, isUrlLoading: false, isXmlLoading: false });
    const dateToCheck = '2025-09-17';
    try {
        const dates = await getSittingDates();
        const wasSitting = dates.includes(dateToCheck);
        setSittingDateCheck(prev => ({ ...prev, isLoading: false, allDates: dates, wasSitting: wasSitting }));

        if (wasSitting) {
            setSittingDateCheck(prev => ({ ...prev, isUrlLoading: true }));
            await sleep(1000); // Respectful delay
            try {
                const hansardUrl = await getHansardLinkForDate(dateToCheck);
                setSittingDateCheck(prev => ({ ...prev, isUrlLoading: false, hansardUrl }));

                if (hansardUrl) {
                    setSittingDateCheck(prev => ({...prev, isXmlLoading: true}));
                    await sleep(1000); // Respectful delay
                    try {
                        const xmlUrl = await getHansardXmlLink(hansardUrl);
                        if(xmlUrl) setUrl(xmlUrl); // Set the main input URL
                    } catch (xmlError) {
                         const xmlErrorMessage = xmlError instanceof Error ? xmlError.message : 'An unknown error occurred while finding XML link.';
                         setSittingDateCheck(prev => ({ ...prev, error: `${prev.error ? `${prev.error}\n` : ''}${xmlErrorMessage}`}));
                    } finally {
                        setSittingDateCheck(prev => ({...prev, isXmlLoading: false}));
                    }
                }
            } catch (urlError) {
                const urlErrorMessage = urlError instanceof Error ? urlError.message : 'An unknown error occurred while fetching the Hansard link.';
                setSittingDateCheck(prev => ({ ...prev, isUrlLoading: false, error: `${prev.error ? `${prev.error}\n` : ''}${urlErrorMessage}`}));
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setSittingDateCheck({ isLoading: false, error: errorMessage, allDates: [], wasSitting: null, hansardUrl: null, isUrlLoading: false, isXmlLoading: false });
    }
  };

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
            </CardTitle>
            <Badge variant="secondary" className="w-fit">{intervention.type}</Badge>
          </CardHeader>
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
        <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark />
                  House of Commons Debates
                </CardTitle>
                <CardDescription>
                  Tools for fetching and analyzing parliamentary transcripts and data.
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
                  <Button onClick={handleLoad} disabled={isLoading || !url}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                    Load Transcript
                  </Button>
                </div>
                 <p className="text-xs text-muted-foreground">
                    Example: <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{url} <ExternalLink className="inline-block h-3 w-3" /></a>
                </p>
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarDays /> Sitting Calendar</CardTitle>
                    <CardDescription>Check if the House of Commons was in session on a specific day and find the transcript XML.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleSittingDateCheck} disabled={sittingDateCheck.isLoading}>
                        {sittingDateCheck.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Check for Sitting on Sep 17, 2025
                    </Button>
                     {sittingDateCheck.isLoading && <p className="mt-4 text-sm text-muted-foreground">Checking calendar...</p>}
                     {sittingDateCheck.error && <p className="mt-4 text-sm text-destructive">{sittingDateCheck.error}</p>}
                     {sittingDateCheck.wasSitting !== null && (
                        <div className="mt-4 space-y-4">
                            <div>
                                <h3 className="font-semibold">Did the House sit on September 17, 2025?</h3>
                                <p className={`text-2xl font-bold ${sittingDateCheck.wasSitting ? 'text-green-600' : 'text-red-600'}`}>
                                    {sittingDateCheck.wasSitting ? 'Yes' : 'No'}
                                </p>
                            </div>
                            
                            {sittingDateCheck.isUrlLoading && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    <span>Finding Hansard link... (1s delay)</span>
                                </div>
                            )}

                            {sittingDateCheck.hansardUrl && (
                                <div>
                                    <h3 className="font-semibold flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Found Hansard Link:</h3>
                                    <a href={sittingDateCheck.hansardUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline break-all">
                                        {sittingDateCheck.hansardUrl}
                                    </a>
                                </div>
                            )}

                            {sittingDateCheck.isXmlLoading && (
                                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    <span>Finding XML link... (1s delay)</span>
                                </div>
                            )}

                            {!sittingDateCheck.isXmlLoading && url.endsWith('.XML') && sittingDateCheck.hansardUrl && (
                                <div>
                                    <h3 className="font-semibold flex items-center gap-2"><FileCode className="h-4 w-4" /> Found XML Transcript Link:</h3>
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline break-all">
                                        {url}
                                    </a>
                                     <p className="text-xs text-muted-foreground mt-1">The URL has been copied to the input field above.</p>
                                </div>
                            )}


                             <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger>View all extracted sitting dates (for testing)</AccordionTrigger>
                                    <AccordionContent>
                                        <pre className="mt-2 bg-muted p-4 rounded-md text-xs max-h-60 overflow-auto">
                                            {JSON.stringify(sittingDateCheck.allDates, null, 2)}
                                        </pre>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                     )}
                </CardContent>
            </Card>
        </div>
        
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
                        {isSummarizingFull ? <Hourglass className="mr-2 h-4 w-4 animate-spin" /> : <ScrollText className="mr-2 h-4 w-4" />}
                        {isSummarizingFull ? 'Summarizing...' : 'Generate Full Summary'}
                    </Button>
                </CardFooter>
            </Card>
        )}

        {isSummarizingFull && (
            <div className="mt-6 flex justify-center items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Summarization in progress. This may take several minutes. You can leave this page and come back.</span>
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
                        {fullSummary.topics?.map((topic, index) => (
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

                     {fullSummary.debugInfo && (
                        <Accordion type="single" collapsible className="w-full mt-4">
                        <AccordionItem value="debug-info">
                            <AccordionTrigger>
                                <span className="flex items-center gap-2"><Bug className="h-4 w-4" /> Summarization Debugger</span>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4">
                                <div>
                                    <h4 className="font-semibold text-lg mb-2">Final Prompt to AI (Full Transcript)</h4>
                                    <p className="text-xs text-muted-foreground mb-2">The following is the full transcript text sent to the model for summarization.</p>
                                    <pre className="whitespace-pre-wrap font-body text-xs bg-muted p-4 rounded-md max-h-[400px] overflow-auto">{fullSummary.debugInfo.finalPrompt}</pre>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg mb-2">Debug Information</h4>
                                    <div className="space-y-2 max-h-[600px] overflow-auto pr-2">
                                    {fullSummary.debugInfo.chunkSummaries.map((chunk, index) => (
                                        <div key={index} className="bg-muted/50 p-3 rounded-md">
                                            <p className="text-sm whitespace-pre-wrap font-mono">{chunk}</p>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        </Accordion>
                    )}
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
