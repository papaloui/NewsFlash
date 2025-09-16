'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/app/header';
import { getHansardSummary, type HansardSummaryResponse } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, Loader2, Info, Code } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function HouseOfCommonsPage() {
  const [summary, setSummary] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<HansardSummaryResponse['debugInfo'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        const result = await getHansardSummary();
        setSummary(result.summary);
        if (result.debugInfo) {
          setDebugInfo(result.debugInfo);
        }
      } catch (error) {
        console.error('Failed to get Hansard summary:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Could not generate the summary: ${errorMessage}`,
        });
        setSummary('Failed to load summary. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark />
              House of Commons Daily Summary
            </CardTitle>
            <CardDescription>
                An AI-generated summary of the most recent sitting of the Canadian House of Commons.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating summary... this may take a moment.</span>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap font-body">
                {summary}
              </div>
            )}
          </CardContent>
           {debugInfo && !isLoading && (
              <CardFooter>
                  <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                          <AccordionTrigger>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                 <Info className="h-4 w-4" />
                                 Show Debugging Info
                              </div>
                          </AccordionTrigger>
                          <AccordionContent>
                              <div className="p-4 bg-muted/50 rounded-lg text-xs space-y-4">
                                  <div>
                                      <h4 className="font-semibold">Source URL:</h4>
                                      <a href={debugInfo.url} target="_blank" rel="noopener noreferrer" className="text-primary break-all">{debugInfo.url}</a>
                                  </div>
                                   <div>
                                      <h4 className="font-semibold">Extracted Text (first 5000 chars):</h4>
                                      <pre className="whitespace-pre-wrap font-code text-muted-foreground mt-1 p-2 border rounded-md bg-background max-h-60 overflow-y-auto">
                                        {debugInfo.transcript || "No content was extracted."}
                                      </pre>
                                  </div>
                                   <Accordion type="single" collapsible className="w-full">
                                      <AccordionItem value="raw-response">
                                          <AccordionTrigger>
                                             <div className="flex items-center gap-2 text-sm">
                                                 <Code className="h-4 w-4" />
                                                 Show Raw API Response (XML)
                                             </div>
                                          </AccordionTrigger>
                                          <AccordionContent>
                                              <pre className="whitespace-pre-wrap font-code text-muted-foreground mt-1 p-2 border rounded-md bg-background max-h-80 overflow-y-auto">
                                                {debugInfo.rawResponse || "No API response was fetched."}
                                              </pre>
                                          </AccordionContent>
                                      </AccordionItem>
                                  </Accordion>
                              </div>
                          </AccordionContent>
                      </AccordionItem>
                  </Accordion>
              </CardFooter>
           )}
        </Card>
      </main>
    </div>
  );
}
