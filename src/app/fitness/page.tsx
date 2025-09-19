
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { HeartPulse, Loader2, ServerCrash, User, Calendar, Book, ExternalLink, FileText, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getPubMedArticles, type PubMedArticle, getFullArticleText } from './actions';


export default function FitnessPage() {
    const [articles, setArticles] = useState<PubMedArticle[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFetch = async () => {
        setIsLoading(true);
        setError(null);
        setArticles([]);

        try {
            const articleResult = await getPubMedArticles();
            if (articleResult.error || !articleResult.articles) {
                throw new Error(articleResult.error || 'No articles were returned.');
            }
            setArticles(articleResult.articles);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Operation Failed',
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFetchBody = async (pmid: string) => {
        setArticles(prev => prev.map(a => a.pmid === pmid ? { ...a, isBodyLoading: true } : a));
        
        const article = articles.find(a => a.pmid === pmid);
        if (!article || !article.fullTextUrl) return;

        try {
            const body = await getFullArticleText(article.fullTextUrl);
            setArticles(prev => prev.map(a => a.pmid === pmid ? { ...a, body, isBodyLoading: false } : a));
        } catch (error) {
            console.error(`Failed to fetch content for ${article.fullTextUrl}`, error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            setArticles(prev => prev.map(a => a.pmid === pmid ? { ...a, body: `Could not load article content: ${errorMessage}`, isBodyLoading: false } : a));
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto p-4 md:p-6">
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HeartPulse />
                            Fitness & Health Research Digest
                        </CardTitle>
                        <CardDescription>
                            Fetch the latest research articles on exercise science from PubMed. Articles are from the last 24 hours.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleFetch} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HeartPulse className="mr-2 h-4 w-4" />}
                            {isLoading ? 'Fetching Articles...' : 'Fetch Latest Articles'}
                        </Button>
                    </CardContent>
                </Card>

                {isLoading && (
                    <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-lg">Processing latest fitness research...</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Data Unavailable</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90">{error}</p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve information from the PubMed API. This could be a temporary issue. Please try again later.</p>
                        </CardContent>
                      </Card>
                )}

                {!isLoading && articles.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                        {articles.map(article => (
                            <Card key={article.pmid} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">{article.title}</CardTitle>
                                    <CardDescription>
                                        <span className="flex items-center gap-4 text-xs flex-wrap pt-2">
                                            <span className="flex items-center gap-1.5"><Book /> {article.journal}</span>
                                            <span className="flex items-center gap-1.5"><Calendar /> {article.publication_date}</span>
                                        </span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm flex-grow">
                                    <div className="flex items-start gap-2">
                                        <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div>
                                            <span className="font-semibold">Authors:</span> {article.authors.join(', ')}
                                        </div>
                                    </div>
                                    
                                    <Accordion type="single" collapsible className="w-full">
                                        <AccordionItem value="abstract">
                                            <AccordionTrigger>View Abstract</AccordionTrigger>
                                            <AccordionContent className="whitespace-pre-wrap font-body text-xs leading-relaxed">
                                                {article.abstract}
                                            </AccordionContent>
                                        </AccordionItem>
                                        {article.fullTextUrl && (
                                            <AccordionItem value="full-text">
                                                <AccordionTrigger onClick={() => !article.body && handleFetchBody(article.pmid)}>
                                                    <span className="flex items-center gap-2">
                                                        <BookOpen className="h-4 w-4" />
                                                        Read Full Article
                                                    </span>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    {article.isBodyLoading ? (
                                                        <div className="pt-3 border-t flex items-center gap-2 text-muted-foreground">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            <span>Fetching article content...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="pt-3 border-t">
                                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{article.body}</p>
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}
                                    </Accordion>

                                </CardContent>
                                <CardFooter className="flex-col sm:flex-row gap-2 items-center">
                                    {article.fullTextUrl && (
                                        <Button asChild variant="secondary" size="sm" className="w-full">
                                            <a href={article.fullTextUrl} target="_blank" rel="noopener noreferrer">
                                                View on Publisher Site
                                                <FileText className="ml-2 h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                    <Button asChild variant="outline" size="sm" className="w-full">
                                        <a href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`} target="_blank" rel="noopener noreferrer">
                                            View on PubMed
                                            <ExternalLink className="ml-2 h-4 w-4" />
                                        </a>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
                 {!isLoading && !error && articles.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Click the button above to fetch the latest articles.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
