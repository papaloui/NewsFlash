
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Landmark, Loader2, Search, BookOpen, Clock, Languages, User, FileText as FileTextIcon, ExternalLink, ScrollText, Bug, Hourglass } from 'lucide-react';
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

interface AutomationStatus {
    step: 'idle' | 'checking_calendar' | 'found_sitting' | 'finding_hansard_url' | 'found_hansard_url' | 'finding_xml_url' | 'found_xml_url' | 'loading_transcript' | 'summarizing' | 'complete' | 'no_sitting' | 'error';
    message: string;
    error?: string;
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
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>({ step: 'idle', message: 'Ready to start.' });

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getFullTranscriptText = useCallback(() => {
    if (!data) return '';
    return data.interventions.map(i => {
      const speaker = i.speaker || 'Unnamed Speaker';
      const text = i.content.filter(c => c.type === 'text').map(c => c.value).join(' ');
      if (i.type === 'OrderOfBusiness' || i.type === 'SubjectOfBusiness') {
        return `\n--- ${text} ---\n`;
      }
      if (!text) return '';
      return `${speaker}:\n${text}`;
    }).join('\n\n');
  }, [data]);

  const pollJobStatus = useCallback((id: string) => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const statusResult = await checkSummaryJob(id);
        if (statusResult.status === 'completed') {
          setFullSummary(statusResult.result!);
          setIsSummarizing(false);
          setJobId(null);
          setAutomationStatus({ step: 'complete', message: 'Debate summary is complete.' });
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        } else if (statusResult.status === 'error') {
          setSummaryError(`Error generating summary: ${statusResult.error}`);
          setIsSummarizing(false);
          setJobId(null);
          setAutomationStatus({ step: 'error', message: 'Failed during summary generation.', error: statusResult.error });
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        }
        // If 'pending', do nothing and wait for the next interval
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while polling.';
        setSummaryError(errorMessage);
        setIsSummarizing(false);
        setJobId(null);
        setAutomationStatus({ step: 'error', message: 'Polling for summary failed.', error: errorMessage });
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      }
    }, 5000); // Poll every 5 seconds
  }, []);

  const handleFullSummary = useCallback(async () => {
    const transcriptText = getFullTranscriptText();
    if (transcriptText.length === 0) return;
    
    setIsSummarizing(true);
    setFullSummary(null);
    setSummaryError(null);
    setJobId(null);
    setAutomationStatus({ step: 'summarizing', message: 'Generating full debate summary. This may take a few minutes...' });
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    try {
      const { jobId: newJobId } = await startTranscriptSummary(transcriptText);
      setJobId(newJobId);
      pollJobStatus(newJobId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setSummaryError(`Error starting summary job: ${errorMessage}`);
      setIsSummarizing(false);
      setAutomationStatus({ step: 'error', message: 'Failed to start summary job.', error: errorMessage });
    }
  }, [getFullTranscriptText, pollJobStatus]);

  const handleLoad = useCallback(async (loadUrl: string) => {
    setIsLoading(true);
    setData(null);
    setFullSummary(null);
    setAutomationStatus({ step: 'loading_transcript', message: `Loading and parsing transcript from ${loadUrl}` });

    try {
      const res = await fetch(`/api/hansard?url=${encodeURIComponent(loadUrl)}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load Hansard data.');
      }
      const jsonData: HansardData = await res.json();
      if (!jsonData.interventions || jsonData.interventions.length === 0) {
        throw new Error("Parsing completed, but no interventions were found in the XML.");
      }
      setData(jsonData);
      // Automatically trigger summarization after loading
      await sleep(1000); // Wait a second before starting summary
      await handleFullSummary();

    } catch (error) {
      console.error('Failed to get Hansard data:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Could not load data: ${errorMessage}`,
      });
      setAutomationStatus({ step: 'error', message: 'Failed to load transcript.', error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [handleFullSummary, toast]);
  
  const runAutomatedDebateFetch = useCallback(async () => {
    const dateToCheck = '2025-09-17';
    try {
        setAutomationStatus({ step: 'checking_calendar', message: 'Checking parliamentary sitting calendar...' });
        const dates = await getSittingDates();
        const wasSitting = dates.includes(dateToCheck);

        if (wasSitting) {
            setAutomationStatus({ step: 'found_sitting', message: `House was sitting on ${dateToCheck}.` });
            await sleep(1000);

            setAutomationStatus({ step: 'finding_hansard_url', message: 'Finding Hansard debate link...' });
            const hansardUrl = await getHansardLinkForDate(dateToCheck);

            if (hansardUrl) {
                setAutomationStatus({ step: 'found_hansard_url', message: `Found Hansard link.` });
                await sleep(1000);

                setAutomationStatus({ step: 'finding_xml_url', message: 'Finding XML transcript link...' });
                const xmlUrl = await getHansardXmlLink(hansardUrl);

                if (xmlUrl) {
                    setAutomationStatus({ step: 'found_xml_url', message: 'Found XML link. Starting transcript load.' });
                    setUrl(xmlUrl);
                    await sleep(1000); // Wait a second before loading
                    await handleLoad(xmlUrl); // Automatically load
                } else {
                    throw new Error('Could not find the XML link on the Hansard page.');
                }
            } else {
                throw new Error('Could not find the Hansard Debates link for the specified date.');
            }
        } else {
            setAutomationStatus({ step: 'no_sitting', message: `House was not sitting on ${dateToCheck}. No further action.` });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error('Automated debate fetch failed:', error);
        setAutomationStatus({ step: 'error', message: 'Automated process failed.', error: errorMessage });
    }
  }, [handleLoad]);


  useEffect(() => {
    runAutomatedDebateFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const renderIntervention = (intervention: Intervention, idx: number) => {
    const isSectionHeading = intervention.type === 'OrderOfBusiness' || intervention.type === 'SubjectOfBusiness';
    const sectionId = intervention.id || `section-${idx}`;

    const textContent = intervention.content.filter(c => c.type === 'text').map(c => c.value).join(' ');

    if (isSectionHeading) {
      const title = textContent;
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

    if (!intervention.speaker || intervention.content.length === 0 || !textContent) return null;

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
      const fullText = i.content.filter(c => c.type === 'text').map(c => c.value).join(' ').toLowerCase();
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
                  Tools for fetching and analyzing parliamentary transcripts and data. This page now automatically fetches the previous day's debates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2"><Hourglass/> Automation Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mt-4">
                           {(automationStatus.step === 'idle' || automationStatus.step.includes('finding') || automationStatus.step.includes('checking') || automationStatus.step === 'loading_transcript' || automationStatus.step === 'summarizing') && (
                             <Loader2 className="h-5 w-5 animate-spin"/>
                           )}
                           <p className="text-sm text-muted-foreground">{automationStatus.message}</p>
                        </div>
                        {automationStatus.step === 'error' && <p className="mt-2 text-sm text-destructive">{automationStatus.error}</p>}
                    </CardContent>
                 </Card>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter Hansard XML URL or let automation run..."
                    disabled={isLoading || isSummarizing}
                    className="flex-1"
                  />
                  <Button onClick={() => handleLoad(url)} disabled={isLoading || isSummarizing || !url}>
                    {(isLoading || isSummarizing) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                    Load Manually
                  </Button>
                </div>
                 <p className="text-xs text-muted-foreground">
                    Example: <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{url} <ExternalLink className="inline-block h-3 w-3" /></a>
                </p>
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
                    <Button onClick={handleFullSummary} disabled={isSummarizing}>
                        {isSummarizing ? <Hourglass className="mr-2 h-4 w-4 animate-spin" /> : <ScrollText className="mr-2 h-4 w-4" />}
                        {isSummarizing ? 'Summarizing...' : 'Regenerate Full Summary'}
                    </Button>
                </CardFooter>
            </Card>
        )}

        {isSummarizing && (
            <div className="mt-6 flex justify-center items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Summarization in progress. This may take several minutes.</span>
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

        {isLoading && !data && (
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
