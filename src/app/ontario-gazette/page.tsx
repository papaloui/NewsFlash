
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Newspaper, Loader2, ServerCrash, Sparkles, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAndSummarizeOntarioGazette } from './actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface DebugInfo {
    step: string;
    url: string;
    html: string;
}

export default function OntarioGazettePage() {
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
    const { toast } = useToast();

    const handleFetch = async () => {
        setIsLoading(true);
        setError(null);
        setSummary(null);
        setDebugInfo(null);

        try {
            const result = await getAndSummarizeOntarioGazette();
            if (result.error) {
                if (result.debugInfo) {
                    setDebugInfo(result.debugInfo);
                }
                throw new Error(result.error);
            }
            setSummary(result.summary || null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Failed to process Ontario Gazette',
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto p-4 md:p-6">
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Newspaper />
                            Ontario Gazette
                        </CardTitle>
                        <CardDescription>
                            Fetch the latest Ontario Gazette PDF and generate an AI-powered summary of its key contents.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleFetch} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Fetch & Summarize Latest Gazette
                        </Button>
                    </CardContent>
                </Card>

                {isLoading && (
                    <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-lg">Fetching, parsing, and summarizing... This multi-step process may take a moment.</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Processing Failed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90 font-semibold">Error Message: <span className="font-normal text-muted-foreground">{error}</span></p>
                          {debugInfo && (
                            <Accordion type="single" collapsible className="w-full mt-4">
                                <AccordionItem value="debug-info">
                                    <AccordionTrigger>
                                        <span className="flex items-center gap-2"><FileCode className="h-4 w-4" /> View Debugging Information</span>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <p className="text-sm">The process failed at <Badge variant="secondary">Step {debugInfo.step}</Badge>. The following URL was being processed:</p>
                                        <pre className="p-2 bg-muted/50 rounded-md text-xs overflow-auto border"><code>{debugInfo.url}</code></pre>
                                        
                                        <h4 className="font-semibold pt-4 border-t">Raw HTML Content:</h4>
                                        <pre className="p-4 bg-muted/50 rounded-md text-xs overflow-auto max-h-96 border">
                                            <code>{debugInfo.html}</code>
                                        </pre>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                          )}
                        </CardContent>
                      </Card>
                )}
                
                {summary && !isLoading && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>AI Summary of the Ontario Gazette</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-wrap font-body text-sm leading-relaxed">{summary}</p>
                        </CardContent>
                    </Card>
                )}

            </main>
        </div>
    );
}
