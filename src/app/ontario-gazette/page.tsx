
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Newspaper, Loader2, ServerCrash, Sparkles, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAndSummarizeOntarioGazette } from './actions';

export default function OntarioGazettePage() {
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFetch = async () => {
        setIsLoading(true);
        setError(null);
        setSummary(null);
        setSourceUrl(null);

        try {
            const result = await getAndSummarizeOntarioGazette();
            setSourceUrl(result.sourceUrl || null);
            if (result.error) {
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
                        <span className="text-lg">Fetching PDF and summarizing... This may take a moment.</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Processing Failed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90 font-semibold">Error Message: <span className="font-normal text-muted-foreground">{error}</span></p>
                           {sourceUrl && (
                             <p className="text-sm text-muted-foreground mt-2">Attempted to fetch from: <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{sourceUrl}</a></p>
                          )}
                        </CardContent>
                      </Card>
                )}
                
                {summary && !isLoading && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>AI Summary of the Ontario Gazette</CardTitle>
                             {sourceUrl && (
                               <CardDescription className="flex items-center gap-2 pt-2">
                                <LinkIcon className="h-4 w-4"/>
                                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    Source PDF
                                    <ExternalLink className="inline-block ml-1 h-3 w-3" />
                                </a>
                               </CardDescription>
                            )}
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
