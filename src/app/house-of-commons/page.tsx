'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, Loader2, Search, BookText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"


interface Speech {
    speaker?: string;
    timestamp?: string;
    text: string;
}

interface HansardData {
    speeches: Speech[];
}

export default function HouseOfCommonsPage() {
  const [url, setUrl] = useState('https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML');
  const [data, setData] = useState<HansardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fullTranscript, setFullTranscript] = useState<string>('');
  const { toast } = useToast();

  const handleLoad = async () => {
    setIsLoading(true);
    setData(null);
    setFullTranscript('');
    try {
      const res = await fetch(`/api/hansard?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load Hansard data.');
      }
      const jsonData: HansardData = await res.json();
      setData(jsonData);
      
      if (jsonData.speeches) {
        const transcript = jsonData.speeches.map(s => `Speaker: ${s.speaker || 'Unknown'}\nTime: ${s.timestamp || 'N/A'}\n\n${s.text}`).join('\n\n---\n\n');
        setFullTranscript(transcript);
      }

    } catch (error) {
      console.error('Failed to get Hansard data:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Could not load data: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSpeeches = data?.speeches.filter(s =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.speaker?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark />
              House of Commons Debates
            </CardTitle>
            <CardDescription>
              Fetch and view transcripts from a Hansard XML URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter Hansard XML URL..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={handleLoad} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load Transcript
              </Button>
            </div>
            {data && (
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Search speeches by keyword or speaker..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                  />
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading && (
            <div className="mt-6 flex justify-center items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Fetching and parsing transcript...</span>
            </div>
        )}

        {fullTranscript && (
          <Collapsible className="mt-6">
             <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  <BookText className="mr-2 h-4 w-4" />
                  Toggle Full Transcript View
                </Button>
              </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <CardHeader>
                  <CardTitle>Full Transcript</CardTitle>
                  <CardDescription>The complete text extracted from the XML for debugging.</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap font-mono text-xs bg-muted p-4 rounded-lg">{fullTranscript}</pre>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {data && (
          <div className="mt-6 space-y-6">
            <h2 className="text-xl font-bold">Speeches ({filteredSpeeches.length})</h2>
            {filteredSpeeches.length > 0 ? filteredSpeeches.map((speech, i) => (
              <Card key={i} className="shadow-sm">
                <CardHeader className='pb-2'>
                  <CardTitle className="text-base font-semibold">{speech.speaker || 'Unknown Speaker'}</CardTitle>
                  {speech.timestamp && <CardDescription className="text-xs">{speech.timestamp}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap font-body text-sm leading-relaxed">{speech.text}</p>
                </CardContent>
              </Card>
            )) : (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No speeches match your search query.</p>
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
