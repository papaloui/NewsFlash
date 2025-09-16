'use client';

import { useState, useEffect } from 'react';
import { processFeeds } from '@/app/actions';
import { Header } from '@/components/app/header';
import { FeedManager } from '@/components/app/feed-manager';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import type { FeedCollection, SummarizedArticle } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";

const defaultCollections: FeedCollection[] = [
    {
        id: "1",
        name: "Global News",
        feeds: ["http://rss.cnn.com/rss/cnn_topstories.rss", "https://feeds.bbci.co.uk/news/world/rss.xml"]
    },
    {
        id: "2",
        name: "Tech News",
        feeds: ["https://techcrunch.com/feed/", "https://www.theverge.com/rss/index.xml", "https://www.wired.com/feed/rss"]
    },
    {
        id: "3",
        name: "Canadian News",
        feeds: ["https://www.cbc.ca/webfeed/rss/rss-canada"]
    }
];

export default function Home() {
  const [collections, setCollections] = useState<FeedCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [articles, setArticles] = useState<SummarizedArticle[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedCollections = localStorage.getItem('newsflash-collections');
      if (storedCollections) {
        const parsedCollections = JSON.parse(storedCollections);
        setCollections(parsedCollections);
        if (parsedCollections.length > 0) {
            setSelectedCollectionId(parsedCollections[0].id);
        }
      } else {
        setCollections(defaultCollections);
        localStorage.setItem('newsflash-collections', JSON.stringify(defaultCollections));
        setSelectedCollectionId(defaultCollections[0].id);
      }
    } catch (error) {
        console.error("Failed to parse collections from localStorage", error);
        setCollections(defaultCollections);
        setSelectedCollectionId(defaultCollections[0].id);
    }
  }, []);

  useEffect(() => {
    try {
        if (collections.length > 0) {
            localStorage.setItem('newsflash-collections', JSON.stringify(collections));
        }
    } catch (error) {
        console.error("Failed to save collections to localStorage", error);
    }
  }, [collections]);

  const handleFetchNews = async () => {
    if (!selectedCollectionId) {
        toast({
            variant: "destructive",
            title: "No Collection Selected",
            description: "Please select a collection to fetch news from.",
        });
        return;
    }

    const selectedCollection = collections.find(c => c.id === selectedCollectionId);
    if (!selectedCollection || selectedCollection.feeds.length === 0) {
        toast({
            variant: "destructive",
            title: "No Feeds in Collection",
            description: "The selected collection has no RSS feeds.",
        });
        return;
    }
    
    setIsFetching(true);
    setArticles([]);

    try {
      const results = await processFeeds(selectedCollection.feeds);
      setArticles(results);
       if (results.length === 0) {
         toast({
            title: "No Articles Found",
            description: "Could not find any articles to display. The feeds might be empty or incompatible.",
         });
       }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error Fetching News",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <FeedManager 
            collections={collections}
            setCollections={setCollections}
            selectedCollectionId={selectedCollectionId}
            setSelectedCollectionId={setSelectedCollectionId}
            onFetch={handleFetchNews}
            isFetching={isFetching}
        />
        
        <div className="transition-opacity duration-300">
            {isFetching ? <NewsBoardSkeleton /> : <NewsBoard articles={articles} />}
        </div>
      </main>
    </div>
  );
}
