
'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import { useToast } from "@/hooks/use-toast";
import { getArticleContent } from './actions';
import { FeedManager } from '@/components/app/feed-manager';
import type { FeedCollection, Article } from '@/lib/types';

export type ArticleWithContent = Article & { body?: string };

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
  const [articles, setArticles] = useState<ArticleWithContent[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingBodies, setIsFetchingBodies] = useState(false);
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
    setIsFetchingBodies(true);
    setArticles([]);

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
        
        const top5Articles = fetchedArticles.slice(0, 5);
        setArticles(top5Articles);
        setIsFetching(false); // Done fetching headlines

        // Fetch bodies for the top 5
        let articlesWithBodies = 0;
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
            } finally {
                articlesWithBodies++;
                if (articlesWithBodies === top5Articles.length) {
                    setIsFetchingBodies(false);
                }
            }
        });
        if(top5Articles.length === 0) {
            setIsFetchingBodies(false);
        }

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Failed to fetch news: ${errorMessage}`,
        });
        setIsFetching(false);
        setIsFetchingBodies(false);
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
            isFetching={isFetching || isFetchingBodies}
        />

        <div className="space-y-6">
          {(isFetching || isFetchingBodies) && <NewsBoardSkeleton />}
          
          <div className="transition-opacity duration-300">
              {!(isFetching || isFetchingBodies) && <NewsBoard articles={articles} onSummarize={() => {}} />}
          </div>
        </div>
      </main>
    </div>
  );
}
