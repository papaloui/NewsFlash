'use client';

import { useState } from 'react';
import { searchNewsAndRank } from '@/ai/flows/search-news-and-rank';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import type { SearchNewsAndRankOutput } from '@/lib/schemas';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const newsTopics = [
    { id: 'global', name: 'Global News' },
    { id: 'tech', name: 'Tech News' },
    { id: 'canada', name: 'Canadian News' },
];

export default function Home() {
  const [articles, setArticles] = useState<SearchNewsAndRankOutput>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFetchNews = async (topicName: string, topicId: string) => {
    setSelectedTopic(topicId);
    setIsFetching(true);
    setArticles([]);

    try {
      const results = await searchNewsAndRank({ query: topicName });
      // Sort by relevance before displaying
      const sortedResults = results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      setArticles(sortedResults);

      if (results.length === 0) {
        toast({
          title: "No Articles Found",
          description: `Couldn't find any articles for "${topicName}".`,
        });
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      // Extract user-friendly message if possible
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
        
        <div className="transition-opacity duration-300">
            {isFetching ? <NewsBoardSkeleton /> : <NewsBoard articles={articles} />}
        </div>
      </main>
    </div>
  );
}
