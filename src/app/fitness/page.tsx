
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { HeartPulse, Loader2, ServerCrash, User, ExternalLink, Trophy, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAndRankPubMedArticles, getArticleXmlText, type PubMedArticle } from './actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type ArticleWithText = PubMedArticle & {
    fullText?: string;
    isFetchingText?: boolean;
    textError?: string;
};

export default function FitnessPage() {
    const [articles, setArticles] = useState<ArticleWithText[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFetch = async () => {
        setIsLoading(true);
        setError(null);
        setArticles([]);

        try {
            const result = await getAndRankPubMedArticles();
            if (result.error || !result.articles) {
                throw new Error(result.error || 'No articles were returned.');
            }
            setArticles(result.articles);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Operation Failed',
                description: 'Could not fetch or rank articles. See details below.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFetchFullText = async (pmid: string) => {
        const targetArticle = articles.find(a => a.pmid === pmid);
        if (!targetArticle || targetArticle.fullText || targetArticle.isFetchingText) return;

        setArticles(prev => prev.map(a => a.pmid === pmid ? { ...a, isFetchingText: true, textError: undefined } : a));

        try {
            const text = await getArticleXmlText(pmid);
            if (text.startsWith("Error:")) {
                throw new Error(text);
            }
            setArticles(prev => prev.map(a => a.pmid === pmid ? { ...a, isFetchingText: false, fullText: text } : a));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setArticles(prev => prev.map(a => a.pmid === pmid ? { ...a, isFetchingText: false, textError: errorMessage } : a));
             toast({
                variant: 'destructive',
                title: 'Failed to Fetch Text',
                description: errorMessage,
            });
        }
    };

    const getFullTextUrl = (article: PubMedArticle) => {
      if (article.doi) {
        return `https://doi.org/${article.doi}`;
      }
      return `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
    }

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
                            Fetches and ranks the latest exercise science articles from PubMed for elite athletes. Articles are from the last 7 days.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleFetch} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
                            {isLoading ? 'Fetching & Ranking...' : 'Get Top 10 Articles'}
                        </Button>
                    </CardContent>
                </Card>

                {isLoading && (
                    <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-lg">Fetching and ranking latest research...</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Operation Failed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90 font-semibold">Error Details:</p>
                          <pre className="mt-2 p-4 bg-muted/50 rounded-md text-xs overflow-auto max-h-96 border whitespace-pre-wrap font-mono">
                            <code>{error}</code>
                          </pre>
                        </CardContent>
                      </Card>
                )}

                {!isLoading && articles.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold tracking-tight">Top 10 Most Relevant Articles</h2>
                        {articles.map((article, index) => (
                            <Card key={article.pmid} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0 bg-primary text-primary-foreground h-8 w-8 rounded-full flex items-center justify-center font-bold text-lg">{index + 1}</div>
                                        <div className="flex-grow">
                                            <CardTitle className="text-lg font-bold">{article.title}</CardTitle>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm flex-grow pl-16">
                                    <div className="flex items-start gap-2">
                                        <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div>
                                            <span className="font-semibold">Authors:</span> {article.authors.slice(0, 3).join(', ')}{article.authors.length > 3 ? ' et al.' : ''}
                                        </div>
                                    </div>
                                    
                                     <Accordion type="single" collapsible>
                                        <AccordionItem value="item-1">
                                            <AccordionTrigger onClick={() => handleFetchFullText(article.pmid)}>
                                                <span className="flex items-center gap-2">
                                                    <BookOpen className="h-4 w-4" />
                                                    Read Full Article
                                                </span>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                {article.isFetchingText ? (
                                                <div className="pt-3 border-t flex items-center gap-2 text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Fetching article content...</span>
                                                </div>
                                                ) : article.textError ? (
                                                    <p className="pt-3 border-t text-sm text-destructive whitespace-pre-wrap font-mono">{article.textError}</p>
                                                ) : article.fullText ? (
                                                <div className="pt-3 border-t">
                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">{article.fullText}</p>
                                                </div>
                                                ) : null}
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>

                                </CardContent>
                                <CardFooter className="flex-col sm:flex-row gap-2 items-center pl-16">
                                    <Button asChild variant="outline" size="sm" className="w-full">
                                        <a href={getFullTextUrl(article)} target="_blank" rel="noopener noreferrer">
                                            Read on Source
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
                        <p className="text-muted-foreground">Click the button above to fetch and rank the latest articles.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
