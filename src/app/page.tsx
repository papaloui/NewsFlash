
'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import type { ArticleWithSummary } from '@/lib/schemas';
import { useToast } from "@/hooks/use-toast";
import { DailyDigest } from '@/components/app/daily-digest';
import { getArticleContent } from './actions';
import { newsAgent } from '@/ai/flows/news-agent';

// Add a 'body' property to our Article type
export type ArticleWithContent = ArticleWithSummary & { body?: string };

export default function Home() {
  const [articles, setArticles] = useState<ArticleWithContent[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [digest, setDigest] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchNewsAndContent = async () => {
      setIsFetching(true);
      try {
        // 1. Fetch top headlines
        const result = await newsAgent({ query: 'top headlines' });
        
        if (result.digest) {
          setDigest(result.digest);
        }

        if (result.articles) {
          const top5Articles = result.articles.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
          setArticles(top5Articles);
          
          // 2. For each article, fetch its full content
          top5Articles.forEach(async (article) => {
            try {
              const body = await getArticleContent(article.link);
              setArticles(prev => 
                prev.map(a => a.link === article.link ? { ...a, body } : a)
              );
            } catch (error) {
               console.error(`Failed to fetch content for ${article.link}`, error);
               setArticles(prev => 
                prev.map(a => a.link === article.link ? { ...a, body: "Could not load article content." } : a)
              );
            }
          });

        }
      } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Failed to fetch news: ${errorMessage}`,
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchNewsAndContent();
  }, [toast]);


  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-6 grid gap-6">
        <div className="space-y-6">
          {isFetching && <NewsBoardSkeleton />}
          
          {!isFetching && digest && <DailyDigest digest={digest} />}
          
          <div className="transition-opacity duration-300">
              {!isFetching && <NewsBoard articles={articles} onSummarize={() => {}} />}
          </div>
        </div>
      </main>
    </div>
  );
}
