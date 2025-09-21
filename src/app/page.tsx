
'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import { useToast } from "@/hooks/use-toast";
import { getArticleContent, summarizeArticlesInBatch } from './actions';
import { FeedManager } from '@/components/app/feed-manager';
import type { FeedCollection, Article } from '@/lib/types';


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
  const [articles, setArticles] = useState<Article[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState('');
  const { toast } = useToast();
  
  const [collections, setCollections] = useState<FeedCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  useEffect(() => {
    try {
        const storedCollections = localStorage.getItem('newsflash-collections');
        if (storedCollections) {
            const parsed = JSON.parse(storedCollections);
            setCollections(parsed);
            if(parsed.length > 0) {
                setSelectedCollectionId(parsed[0].id);
            }
        } else {
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
    setArticles([]);
    setFetchingStatus('Fetching headlines...');

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
        const articlesToProcess = fetchedArticles.slice(0, 10);
        setArticles(articlesToProcess);
        
        setFetchingStatus('Fetching full article content...');
        const articlesWithContentPromises = articlesToProcess.map(async (article) => {
            const body = await getArticleContent(article.link);
            return { ...article, body };
        });

        const articlesWithContent = await Promise.all(articlesWithContentPromises);
        
        setFetchingStatus('Summarizing articles with AI...');
        const articlesForAISummary = articlesWithContent
            .filter(a => a.body && !a.body.startsWith("Error:") && !a.body.startsWith("Could not extract"))
            .map(a => ({
                link: a.link,
                source: a.source,
                headline: a.headline,
                publicationDate: a.publicationDate,
                body: a.body
            }));

        if (articlesForAISummary.length > 0) {
            const aiSummaries = await summarizeArticlesInBatch(articlesForAISummary);
            
            setArticles(prevArticles => {
                const summaryMap = new Map(aiSummaries.map(s => [s.link, s.summary]));
                return prevArticles.map(article => ({
                    ...article,
                    summary: summaryMap.get(article.link) || article.summary, // Use AI summary if available, otherwise fallback to original
                }));
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
        setFetchingStatus('');
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
            isFetching={isFetching}
            fetchingStatus={fetchingStatus}
        />

        <div className="space-y-6">
          {isFetching && <NewsBoardSkeleton status={fetchingStatus} />}
          
          <div className="transition-opacity duration-300">
              {!isFetching && (
                <NewsBoard 
                  articles={articles} 
                />
              )}
          </div>
        </div>
      </main>
    </div>
  );
}
