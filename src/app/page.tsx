'use client';

import { useState } from 'react';
import { searchNewsAndRank } from '@/ai/flows/search-news-and-rank';
import { summarizeHeadlinesDigest } from '@/ai/flows/summarize-headlines-digest';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import type { SearchNewsAndRankOutput } from '@/lib/schemas';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DailyDigest } from '@/components/app/daily-digest';
import { getArticleSummary } from './actions';

const newsTopics = [
    { id: 'global', name: 'Global News' },
    { id: 'tech', name: 'Tech News' },
    { id: 'canada', name: 'Canadian News' },
];

export type ArticleWithSummary = SearchNewsAndRankOutput[0] & { fullSummary?: string; isSummarizing?: boolean };


export default function Home() {
  const [articles, setArticles] = useState<ArticleWithSummary[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFetchNews = async (topicName: string, topicId: string) => {
    setSelectedTopic(topicId);
    setIsFetching(true);
    setArticles([]);
    setDigest(null);

    try {
      const results = await searchNewsAndRank({ query: topicName });
      const sortedResults = results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      setArticles(sortedResults);

      if (results.length > 0) {
        const digestSummary = await summarizeHeadlinesDigest(sortedResults.map(a => a.headline));
        setDigest(digestSummary.digest);
      } else {
        toast({
          title: "No Articles Found",
          description: `Couldn't find any articles for "${topicName}".`,
        });
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      const userFriendlyMessage = errorMessage.includes('rate limit')
        ? 'Too many requests. Please wait a moment before trying again.'
        : errorMessage;
      
      toast({
        variant: "destructive",
        title: "Error Fetching News",
        description: userFriendlyMessage,
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSummarizeArticle = async (articleLink: string) => {
    setArticles(prev => prev.map(a => a.link === articleLink ? { ...a, isSummarizing: true } : a));

    try {
        const summary = await getArticleSummary(articleLink, articleLink);
        setArticles(prev => prev.map(a => a.link === articleLink ? { ...a, fullSummary: summary, isSummarizing: false } : a));
    } catch (error) {
        console.error("Failed to get summary", error);
        const errorMessage = error instanceof Error ? `Summarization failed: ${error.message}` : "Summarization failed.";
        setArticles(prev => prev.map(a => a.link === articleLink ? { ...a, fullSummary: errorMessage, isSummarizing: false } : a));
        toast({
            variant: "destructive",
            title: "Error",
            description: errorMessage
        });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <Card className="border shadow-sm">
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <Label className="text-sm font-medium text-muted-foreground shrink-0">News Topics</Label>
                    <Separator orientation='vertical' className="h-6 hidden sm:block"/>
                    <div className="flex flex-wrap items-center gap-2">
                        {newsTopics.map((topic) => (
                        <Button
                            key={topic.id}
                            variant={selectedTopic === topic.id ? 'default' : 'outline'}
                            onClick={() => handleFetchNews(topic.name, topic.id)}
                            disabled={isFetching}
                        >
                            {isFetching && selectedTopic === topic.id ? 'Fetching...' : topic.name}
                        </Button>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>

        {isFetching && <NewsBoardSkeleton />}
        {!isFetching && digest && <DailyDigest digest={digest} />}
        
        <div className="transition-opacity duration-300">
            {!isFetching && <NewsBoard articles={articles} onSummarize={handleSummarizeArticle} />}
        </div>
      </main>
    </div>
  );
}
