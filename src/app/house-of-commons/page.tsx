'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/app/header';
import { getHansardSummary } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, Loader2 } from 'lucide-react';

export default function HouseOfCommonsPage() {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        const result = await getHansardSummary();
        setSummary(result);
      } catch (error) {
        console.error('Failed to get Hansard summary:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Could not generate the summary: ${errorMessage}`,
        });
        setSummary('Failed to load summary. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark />
              House of Commons Daily Summary
            </CardTitle>
            <CardDescription>
                An AI-generated summary of the most recent sitting of the Canadian House of Commons.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating summary... this may take a moment.</span>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap font-body">
                {summary}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
