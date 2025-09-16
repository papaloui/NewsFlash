
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { newsAgent } from '@/ai/flows/news-agent';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';
import type { ArticleWithSummary } from '@/app/page';

interface ChatInterfaceProps {
    setArticles: (articles: ArticleWithSummary[]) => void;
    setIsFetching: (isFetching: boolean) => void;
    setDigest: (digest: string | null) => void;
}

export function ChatInterface({ setArticles, setIsFetching, setDigest }: ChatInterfaceProps) {
    const [query, setQuery] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const { toast } = useToast();

    const handleQuery = async () => {
        if (!query.trim()) return;

        setIsThinking(true);
        setIsFetching(true);
        setArticles([]);
        setDigest(null);

        try {
            const result = await newsAgent({ query });
            
            if (result.articles) {
                 const sortedResults = result.articles.sort((a, b) => b.relevanceScore - a.relevanceScore);
                 setArticles(sortedResults);
            }

            if (result.digest) {
                setDigest(result.digest);
            }

            if (result.response) {
                toast({
                    title: 'AI Response',
                    description: result.response,
                });
            }

        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({
                variant: 'destructive',
                title: 'Error',
                description: errorMessage,
            });
        } finally {
            setIsThinking(false);
            setIsFetching(false);
            setQuery('');
        }
    };

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex gap-2">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                        placeholder="Ask for news, summaries, or anything else..."
                        disabled={isThinking}
                    />
                    <Button onClick={handleQuery} disabled={isThinking}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {isThinking ? 'Thinking...' : 'Ask AI'}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    e.g., "What's the latest in AI?", "Summarize the top business news", "When were the first US tariffs?"
                </p>
            </CardContent>
        </Card>
    );
}
