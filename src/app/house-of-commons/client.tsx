
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Search, BookOpen, Clock, Languages, User, FileText as FileTextIcon, ExternalLink, ScrollText, Bug, Hourglass, CalendarIcon, ServerCrash, ListChecks } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { startTranscriptSummary, checkSummaryJob, getHansardUrlForDate } from './actions';
import { HansardChat } from '@/components/app/hansard-chat';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

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

export function HouseOfCommonsClient({ allSittingDates }: { allSittingDates: string[] }) {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<HansardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [fullSummary, setFullSummary] = useState<FullSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processLog, setProcessLog] = useState<string[]>(['Process log will appear here.']);
  const [currentError, setCurrentError] = useState<string | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

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
          setProcessLog(log => [...log, 'SUCCESS: Debate summary is complete.']);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        } else if (statusResult.status === 'error') {
          const message = `Error generating summary: ${statusResult.error}`;
          setSummaryError(message);
          setIsSummarizing(false);
          setJobId(null);
          setProcessLog(log => [...log, `ERROR: ${message}`]);
          setCurrentError(message);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        } else {
            setProcessLog(log => [...log, 'Polling... summary still pending.']);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while polling.';
        setSummaryError(errorMessage);
        setIsSummarizing(false);
        setJobId(null);
        setProcessLog(log => [...log, `ERROR: ${errorMessage}`]);
        setCurrentError(errorMessage);
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
    setCurrentError(null);
    setProcessLog(log => [...log, 'Starting full debate summary. This may take a few minutes...']);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    try {
      const { jobId: newJobId } = await startTranscriptSummary(transcriptText);
      setJobId(newJobId);
      setProcessLog(log => [...log, `Summary job started with ID: ${newJobId}. Polling for completion...`]);
      pollJobStatus(newJobId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setSummaryError(`Error starting summary job: ${errorMessage}`);
      setIsSummarizing(false);
      setProcessLog(log => [...log, `ERROR: Failed to start summary job. ${errorMessage}`]);
      setCurrentError(errorMessage);
    }
  }, [getFullTranscriptText, pollJobStatus]);

  const handleLoad = useCallback(async (loadUrl: string) => {
    setIsLoading(true);
    setData(null);
    setFullSummary(null);
    setCurrentError(null);
    setProcessLog(log => [...log, `Loading and parsing transcript from ${loadUrl}`]);

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
      setProcessLog(log => [...log, 'SUCCESS: Transcript parsed.']);
      // Automatically start the summary after loading the data.
      handleFullSummary(); 
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setProcessLog(log => [...log, `ERROR: Could not load data. ${errorMessage}`]);
      setCurrentError(errorMessage);
      toast({ variant: 'destructive', title: 'Error', description: `Could not load data: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  }, [toast, handleFullSummary]);
  
  const handleDateSelect = async (date: string) => {
    setIsLoading(true);
    setData(null);
    setFullSummary(null);
    setSummaryError(null);
    setCurrentError(null);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    setProcessLog([`--- New Process Started at ${new Date().toLocaleTimeString()} ---`, `Selected date: ${date}`]);
    
    try {
        const result = await getHansardUrlForDate(date, allSittingDates);
        setProcessLog(log => [...log, ...result.log]);
        
        if (result.error || !result.url) {
            throw new Error(result.error || 'The constructed URL was null.');
        }
        
        setUrl(result.url);
        await handleLoad(result.url);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setProcessLog(log => [...log, `ERROR: ${errorMessage}`]);
        setCurrentError(errorMessage);
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
        setIsLoading(false);
    }
  };

  // Trigger loading when a date is selected
  useEffect(() => {
    if (selectedDate && allSittingDates.length > 0) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      handleDateSelect(dateString);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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
    <div className="grid gap-6">
        <Card>
            <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className="w-full sm:w-[280px] justify-start text-left font-normal"
                                disabled={isCalendarLoading || isLoading || isSummarizing}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                initialFocus
                                modifiers={{ 
                                    sitting: allSittingDates.map(d => {
                                        const [year, month, day] = d.split('-').map(Number);
                                        return new Date(year, month - 1, day);
                                    }) 
                                }}
                                modifiersClassNames={{ sitting: 'bg-primary/20' }}
                                disabled={isCalendarLoading || isLoading || isSummarizing}
                            />
                        </PopoverContent>
                    </Popover>
                    <p className="text-sm text-muted-foreground text-center sm:text-left flex-shrink-0">OR</p>
                    <div className="flex flex-col sm:flex-row gap-2 flex-grow">
                        <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Enter Hansard XML URL manually"
                        disabled={isLoading || isSummarizing}
                        className="flex-1"
                        />
                        <Button onClick={() => handleLoad(url)} disabled={isLoading || isSummarizing || !url}>
                        {(isLoading || isSummarizing) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                        Load Manually
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ListChecks />
                    Process Log
                </CardTitle>
            </CardHeader>
            <CardContent>
                <pre className="bg-muted p-4 rounded-md text-xs font-mono max-h-60 overflow-auto">
                    {processLog.join('\n')}
                </pre>
            </CardContent>
        </Card>

        {currentError && (
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Process Failed</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive/90 bg-destructive/10 p-4 rounded-md font-mono text-sm">{currentError}</p>
                </CardContent>
            </Card>
        )}
        
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

        {isSummarizing && !fullSummary && (
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
                                    <h4 className="font-semibold text-lg mb-2">Intermediate Summaries (Map Step)</h4>
                                    <p className="text-xs text-muted-foreground mb-2">The following are the summaries generated for each individual transcript chunk.</p>
                                    <div className="space-y-2 max-h-[600px] overflow-auto pr-2">
                                    {fullSummary.debugInfo.chunkSummaries.map((chunk, index) => (
                                        <div key={index} className="bg-muted/50 p-3 rounded-md">
                                            <p className="text-sm whitespace-pre-wrap font-mono">{`Chunk ${index + 1}: ${chunk}`}</p>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg mb-2 mt-4">Final Prompt to AI (Reduce Step)</h4>
                                    <p className="text-xs text-muted-foreground mb-2">The following is the combined prompt of all intermediate summaries that was sent to the model to generate the final output.</p>
                                    <pre className="whitespace-pre-wrap font-body text-xs bg-muted p-4 rounded-md max-h-[400px] overflow-auto">{fullSummary.debugInfo.finalPrompt}</pre>
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
    </div>
  );
}
