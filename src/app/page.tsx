
'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/app/header';
import { NewsBoard } from '@/components/app/news-board';
import { NewsBoardSkeleton } from '@/components/app/skeletons';
import { useToast } from "@/hooks/use-toast";
import { getArticleContent, summarizeArticlesInBatch } from './actions';
import { FeedManager } from '@/components/app/feed-manager';
import type { FeedCollection, Article } from '@/lib/types';
import { summarizeArticlesPrompt } from '@/ai/flows/summarize-articles';

export type ArticleWithStatus = Article & { 
    body?: string;
    aiSummary?: string;
    isSummarizing?: boolean;
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
  const [isFetchingBodies, setIsFetchingBodies] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
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

  const handleSummarize = async (articlesWithBodies: ArticleWithStatus[]) => {
      const articlesToSummarize = articlesWithBodies.filter(a => a.body && a.body.length > 100);
      if (articlesToSummarize.length === 0) {
          toast({ title: "No articles to summarize", description: "Could not fetch content for any articles."});
          return;
      }

      setIsSummarizing(true);
      setArticles(prev => prev.map(a => articlesToSummarize.some(ats => ats.link === a.link) ? { ...a, isSummarizing: true } : a));
      
      const promptPayload = articlesToSummarize.map(({ link, source, headline, publicationDate, body }) => ({ link, source, headline, publicationDate, body: body! }));

      // Debugging: Log the proposed prompt payload
      console.log("===== AI PROMPT PAYLOAD =====");
      console.log("This is the JSON data that will be sent to the AI for summarization.");
      console.log(JSON.stringify(promptPayload, null, 2));
      console.log("===========================");

      try {
          const summaries = await summarizeArticlesInBatch(promptPayload);

          setArticles(prev => prev.map(article => {
              const matchingSummary = summaries.find(s => s.link === article.link);
              return matchingSummary 
                  ? { ...article, aiSummary: matchingSummary.summary, isSummarizing: false }
                  : { ...article, isSummarizing: false }; // Stop loading state even if no summary was returned
          }));

      } catch (error) {
          console.error(error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          toast({ variant: 'destructive', title: 'Summarization Failed', description: errorMessage });
          setArticles(prev => prev.map(a => ({...a, isSummarizing: false})));
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
        
        const articlesToDisplay = fetchedArticles.slice(0, 5);
        setArticles(articlesToDisplay);
        setIsFetching(false); // Done fetching headlines

        // Fetch bodies for the articles
        const articlesWithBodies: ArticleWithStatus[] = await Promise.all(articlesToDisplay.map(async (article) => {
            try {
              const body = await getArticleContent(article.link);
              const articleWithBody = { ...article, body };
              // Update state for individual article as it's fetched
              setArticles(prev => prev.map(a => a.link === article.link ? articleWithBody : a));
              return articleWithBody;
            } catch (error) {
               console.error(`Failed to fetch content for ${article.link}`, error);
               const articleWithError = { ...article, body: "Could not load article content." };
                setArticles(prev => prev.map(a => a.link === article.link ? articleWithError : a));
               return articleWithError;
            }
        }));

        setIsFetchingBodies(false);

        // After all bodies are fetched, trigger summarization
        if(articlesWithBodies.length > 0) {
            await handleSummarize(articlesWithBodies);
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
            isFetching={isFetching || isFetchingBodies || isSummarizing}
        />

        <div className="space-y-6">
          {(isFetching) && <NewsBoardSkeleton />}
          
          <div className="transition-opacity duration-300">
              {!isFetching && <NewsBoard articles={articles} />}
          </div>
        </div>
      </main>
    </div>
  );
}
