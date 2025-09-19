
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { HeartPulse, Loader2, ServerCrash, Sparkles, User, Calendar, Book, ExternalLink, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getPubMedArticles, summarizeArticlesInBatches, type PubMedArticle } from './actions';

type ArticleWithSummary = PubMedArticle & { summary?: string };

export default function FitnessPage() {
    const [articles, setArticles] = useState<ArticleWithSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFetchAndSummarize = async () => {
        setIsLoading(true);
        setIsSummarizing(false);
        setError(null);
        setArticles([]);

        try {
            // 1. Fetch articles
            const articleResult = await getPubMedArticles();
            if (articleResult.error || !articleResult.articles) {
                throw new Error(articleResult.error || 'No articles were returned.');
            }
            const fetchedArticles = articleResult.articles;
            setArticles(fetchedArticles);
            setIsLoading(false);

            // 2. Start summarization
            if (fetchedArticles.length > 0) {
                setIsSummarizing(true);
                const summaries = await summarizeArticlesInBatches(fetchedArticles);
                
                // 3. Match summaries back to articles
                setArticles(prevArticles => {
                    return prevArticles.map(article => {
                        const matchingSummary = summaries.find(s => s.pmid === article.pmid);
                        return matchingSummary ? { ...article, summary: matchingSummary.summary } : article;
                    });
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Operation Failed',
                description: errorMessage,
            });
            setIsLoading(false);
        } finally {
            setIsSummarizing(false);
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
                            Fetch and summarize the latest research articles on exercise science from PubMed. Articles are from the last 24 hours.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleFetchAndSummarize} disabled={isLoading || isSummarizing}>
                            {(isLoading || isSummarizing) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            {isLoading ? 'Fetching Articles...' : (isSummarizing ? 'Summarizing...' : 'Fetch & Summarize Latest')}
                        </Button>
                    </CardContent>
                </Card>

                {(isLoading || isSummarizing) && articles.length === 0 && (
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
                                    
                                    <Accordion type="single" collapsible>
                                        <AccordionItem value="abstract">
                                            <AccordionTrigger>View Abstract</AccordionTrigger>
                                            <AccordionContent className="whitespace-pre-wrap font-body text-xs leading-relaxed">
                                                {article.abstract}
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>

                                     {article.summary || isSummarizing ? (
                                        <Card className="bg-primary/10 border-primary/20 mt-4">
                                            <CardHeader className="pb-2 pt-4">
                                                <CardTitle className="text-base flex items-center gap-2"><Bot /> AI Summary</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {article.summary ? (
                                                    <p className="text-primary/90 text-sm">{article.summary}</p>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-primary/80">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        <span>Generating...</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                     ) : null}

                                </CardContent>
                                <CardFooter>
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
                 {!isLoading && !isSummarizing && !error && articles.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Click the button above to fetch the latest articles.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
