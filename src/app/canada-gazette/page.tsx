
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookMarked, Loader2, ServerCrash, ExternalLink, Link as LinkIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAndSummarizeGazette } from './actions';

export default function CanadaGazettePage() {
    const [pdfLink, setPdfLink] = useState<string | null>(null);
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rawHtml, setRawHtml] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFetch = async () => {
        setIsLoading(true);
        setError(null);
        setPdfLink(null);
        setSummary(null);
        setRawHtml(null);

        try {
            const result = await getAndSummarizeGazette();
            if (result.error) {
                setRawHtml(result.html || 'No HTML content was returned.');
                throw new Error(result.error);
            }
            setPdfLink(result.link || null);
            setSummary(result.summary || null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Failed to process Gazette',
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
                            <BookMarked />
                            Canada Gazette Part I
                        </CardTitle>
                        <CardDescription>
                            Fetch the latest Canada Gazette PDF and generate an AI-powered summary of its key contents.
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
                        <span className="text-lg">Fetching, parsing, and summarizing... This may take a moment.</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Processing Failed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90">{error}</p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve or process the Gazette. The site structure may have changed, or the document might be inaccessible.</p>
                          {rawHtml && (
                            <div className="mt-4">
                                <h3 className="font-semibold">Raw HTML Content of Index Page:</h3>
                                <pre className="mt-2 p-4 bg-muted/50 rounded-md text-xs overflow-auto max-h-96">
                                    <code>{rawHtml}</code>
                                </pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                )}
                
                {summary && !isLoading && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>AI Summary of the Gazette</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-wrap font-body text-sm leading-relaxed">{summary}</p>
                        </CardContent>
                    </Card>
                )}

                {pdfLink && !isLoading && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Source PDF Link</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4">
                            <LinkIcon className="h-5 w-5 text-primary"/>
                            <a href={pdfLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                                {pdfLink}
                                <ExternalLink className="inline-block ml-2 h-4 w-4" />
                            </a>
                        </CardContent>
                    </Card>
                )}

            </main>
        </div>
    );
}
