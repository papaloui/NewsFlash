
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookMarked, Loader2, ServerCrash, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLatestGazettePdfLink } from './actions';

export default function CanadaGazettePage() {
    const [pdfLink, setPdfLink] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFetchLink = async () => {
        setIsLoading(true);
        setError(null);
        setPdfLink(null);
        try {
            const result = await getLatestGazettePdfLink();
            if (result.error) {
                throw new Error(result.error);
            }
            setPdfLink(result.link);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Failed to get link',
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
                            Fetch the direct link to the latest PDF for Part I of the Canada Gazette.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleFetchLink} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                            Fetch Latest PDF Link
                        </Button>
                    </CardContent>
                </Card>

                {isLoading && (
                    <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-lg">Fetching link...</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Fetch Failed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90">{error}</p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve the link from the Canada Gazette website. The site structure may have changed.</p>
                        </CardContent>
                      </Card>
                )}
                
                {pdfLink && !isLoading && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Extracted PDF Link</CardTitle>
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
