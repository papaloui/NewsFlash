
'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import { useToast } from "@/hooks/use-toast";
import { getArticleContent } from './actions';
import { FeedManager } from '@/components/app/feed-manager';
import type { FeedCollection, Article } from '@/lib/types';
import { summarizeHeadlinesDigest } from '@/ai/flows/summarize-headlines-digest';
import { DailyDigest } from '@/components/app/daily-digest';


export type ArticleWithStatus = Article & { 
    body?: string;
};

const initialCollections: FeedCollection[] = [
    {
      id: '1',
      name: 'Tech News',
      feeds: [
        'https://www.theverge.com/rss/index.xml',
        'https://techcrunch.com/feed/',
        'http://feeds.arstechnica.com/arstechnica/index',
      ],
    },
    {
      id: '2',
      name: 'World News',
      feeds: ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://www.aljazeera.com/xml/rss/all.xml'],
    },
];
  

export default function Home() {
  const [articles, setArticles] = useState<ArticleWithStatus[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [collections, setCollections] = useState<FeedCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  useEffect(() => {
    // Load collections from localStorage on mount
    try {
        const storedCollections = localStorage.getItem('newsflash-collections');
        if (storedCollections) {
            const parsed = JSON.parse(storedCollections);
            setCollections(parsed);
            if(parsed.length > 0) {
                setSelectedCollectionId(parsed[0].id);
            }
        } else {
            // Load initial default collections if nothing is stored
            setCollections(initialCollections);
            setSelectedCollectionId(initialCollections[0].id);
        }
    } catch (error) {
        console.error("Failed to load collections from localStorage", error);
        setCollections(initialCollections);
        if(initialCollections.length > 0) {
            setSelectedCollectionId(initialCollections[0].id);
        }
    }
  }, []);

  useEffect(() => {
    // Save collections to localStorage whenever they change
    if(collections.length > 0) {
        try {
            localStorage.setItem('newsflash-collections', JSON.stringify(collections));
        } catch (error) {
            console.error("Failed to save collections to localStorage", error);
        }
    }
  }, [collections]);

  const handleSummarizeDigest = async (articlesToSummarize: ArticleWithStatus[]) => {
      const articlesForDigest = articlesToSummarize
        .filter(a => a.body) // Only include articles that have a body
        .map(a => ({ headline: a.headline, body: a.body! }));

      if (articlesForDigest.length === 0) return;

      setIsSummarizing(true);
      setDigest(null);
      
      try {
          const result = await summarizeHeadlinesDigest(articlesForDigest);
          setDigest(result.digest);
      } catch (error) {
          console.error(error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          toast({ variant: 'destructive', title: 'Digest Failed', description: errorMessage });
      } finally {
          setIsSummarizing(false);
      }
  };


  const handleFetch = async () => {
    if (!selectedCollectionId) return;

    const selectedCollection = collections.find(c => c.id === selectedCollectionId);
    if (!selectedCollection || selectedCollection.feeds.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'The selected collection has no RSS feeds.',
        });
        return;
    }

    setIsFetching(true);
    setArticles([]);
    setDigest(null);

    try {
        const feedUrls = selectedCollection.feeds;
        const res = await fetch('/api/rss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: feedUrls }),
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to fetch RSS feeds.');
        }

        const fetchedArticles: Article[] = await res.json();
        
        const articlesToDisplay = fetchedArticles.slice(0, 15);
        setArticles(articlesToDisplay);
        
        // Fetch bodies for the articles in parallel
        const articlesWithBodies = await Promise.all(articlesToDisplay.map(async (article) => {
            try {
              const body = await getArticleContent(article.link);
              return { ...article, body };
            } catch (error) {
               console.error(`Failed to fetch content for ${article.link}`, error);
               return { ...article, body: "Could not load article content." };
            }
        }));

        setArticles(articlesWithBodies);

        // Start digest summarization now that all bodies are fetched
        if(articlesWithBodies.length > 0) {
            handleSummarizeDigest(articlesWithBodies);
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


  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-6 grid gap-6">
        <FeedManager
            collections={collections}
            setCollections={setCollections}
            selectedCollectionId={selectedCollectionId}
            setSelectedCollectionId={setSelectedCollectionId}
            onFetch={handleFetch}
            isFetching={isFetching || isSummarizing}
        />

        <div className="space-y-6">
          {(isFetching || isSummarizing) && !digest && <NewsBoardSkeleton />}

          {digest && <DailyDigest digest={digest} isLoading={isSummarizing} />}
          
          <div className="transition-opacity duration-300">
              {!isFetching && <NewsBoard articles={articles} />}
          </div>
        </div>
      </main>
    </div>
  );
}
