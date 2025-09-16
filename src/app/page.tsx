'use client';

import { useState } from 'react';
import { searchNewsAndRank } from '@/ai/flows/search-news-and-rank';
import { summarizeHeadlinesDigest } from '@/ai/flows/summarize-headlines-digest';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import type { SearchNewsAndRankOutput } from '@/lib/schemas';
import { useToast } from "@/hooks/use-toast";
import { DailyDigest } from '@/components/app/daily-digest';
import { getArticleSummary } from './actions';
import { ChatInterface } from '@/components/app/chat-interface';

export type ArticleWithSummary = SearchNewsAndRankOutput[0] & { fullSummary?: string; isSummarizing?: boolean };

export default function Home() {
  const [articles, setArticles] = useState<ArticleWithSummary[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const { toast } = useToast();

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
        <ChatInterface 
          setArticles={setArticles}
          setIsFetching={setIsFetching}
          setDigest={setDigest}
        />

        {isFetching && <NewsBoardSkeleton />}
        {!isFetching && digest && <DailyDigest digest={digest} />}
        
        <div className="transition-opacity duration-300">
            {!isFetching && <NewsBoard articles={articles} onSummarize={handleSummarizeArticle} />}
        </div>
      </main>
    </div>
  );
}
