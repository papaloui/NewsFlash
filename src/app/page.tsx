'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import type { ArticleWithSummary } from '@/lib/schemas';
import { useToast } from "@/hooks/use-toast";
import { DailyDigest } from '@/components/app/daily-digest';
import { getArticleSummary } from './actions';
import { ChatInterface } from '@/components/app/chat-interface';
import { newsAgent } from '@/ai/flows/news-agent';

export default function Home() {
  const [articles, setArticles] = useState<ArticleWithSummary[]>([]);
  const [isFetching, setIsFetching] = useState(true); // Start with fetching state
  const [digest, setDigest] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch initial global news digest on page load
    const fetchInitialDigest = async () => {
      setIsFetching(true);
      try {
        // Fetch top headlines from curated sources
        const result = await newsAgent({ query: 'top headlines' });
        if (result.articles) {
          const sortedResults = result.articles.sort((a, b) => b.relevanceScore - a.relevanceScore);
          setArticles(sortedResults);
        }
        if (result.digest) {
          setDigest(result.digest);
        }
      } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Failed to fetch initial news: ${errorMessage}`,
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchInitialDigest();
  }, [toast]);


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
      <main className="container mx-auto p-4 md:p-6 grid gap-6">
        <div className="space-y-6">
          {isFetching && <NewsBoardSkeleton />}
          
          {!isFetching && digest && <DailyDigest digest={digest} />}
          
          <div className="transition-opacity duration-300">
              {!isFetching && <NewsBoard articles={articles} onSummarize={handleSummarizeArticle} />}
          </div>
        </div>
        
        <ChatInterface 
          setArticles={setArticles}
          setIsFetching={setIsFetching}
          setDigest={setDigest}
        />
      </main>
    </div>
  );
}
