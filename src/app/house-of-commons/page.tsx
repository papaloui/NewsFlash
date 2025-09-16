
'use client';

import { useState } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Landmark, Loader2, Search, BookOpen, Clock, Languages, User, FileText as FileTextIcon, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface InterventionContent {
  type: 'text' | 'timestamp' | 'language' | 'title';
  value: string;
}

interface Intervention {
  type: string | null;
  id: string | null;
  speaker?: string;
  content: InterventionContent[];
}

interface HansardData {
  meta: { [key:string]: string };
  interventions: Intervention[];
}


export default function HouseOfCommonsPage() {
  const [url, setUrl] = useState('https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML');
  const [data, setData] = useState<HansardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const handleLoad = async () => {
    setIsLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/hansard?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to load Hansard data.');
      }
      const jsonData: HansardData = await res.json();
      if (!jsonData.interventions || jsonData.interventions.length === 0) {
        console.error("Parsed data but no interventions found", jsonData);
        throw new Error("Parsing completed, but no interventions were found in the XML.");
      }
      setData(jsonData);

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
  
  const getTextFromContent = (content: InterventionContent[]) => {
    return content.filter(c => c.type === 'text').map(c => c.value).join(' ');
  };
  
  const fullTranscript = data?.interventions.map(i => {
    const speaker = i.speaker || i.type || 'Unknown Speaker';
    const text = getTextFromContent(i.content);
    return `${speaker}:\n${text}`;
  }).join('\n\n') || '';

  const filteredInterventions = data?.interventions.filter(i => {
      const fullText = getTextFromContent(i.content).toLowerCase();
      const speakerName = i.speaker?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return fullText.includes(query) || speakerName.includes(query);
  }) || [];

  const renderIntervention = (intervention: Intervention, idx: number) => {
    if (intervention.type === 'OrderOfBusiness' || intervention.type === 'SubjectOfBusiness') {
      const title = intervention.content.find(c => c.type === 'title')?.value;
      const text = intervention.content.find(c => c.type === 'text')?.value;
      return (
        <div key={idx} className="py-4 my-4 border-y-2 border-primary/20">
          {title && <h3 className="text-lg font-semibold text-primary mb-2">{title}</h3>}
          {text && <p className="text-muted-foreground italic">{text}</p>}
        </div>
      )
    }

    return (
        <Card key={intervention.id || idx} className="shadow-sm">
        <CardHeader className='pb-3'>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {intervention.speaker || 'Unknown Speaker'}
          </CardTitle>
          {intervention.type && <Badge variant="secondary" className="w-fit mt-1">{intervention.type}</Badge>}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {intervention.content.map((item, index) => {
              if (item.type === 'text') {
                return <p key={index} className="whitespace-pre-wrap font-body text-sm leading-relaxed">{item.value}</p>
              }
              if (item.type === 'timestamp') {
                return <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground font-mono"> <Clock className="h-3 w-3" /> {item.value} </div>
              }
              if (item.type === 'language') {
                 return <div key={index} className="flex items-center gap-2 text-xs text-blue-600 italic"> <Languages className="h-3 w-3" /> {item.value} </div>
              }
              return null;
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

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
              Fetch and parse transcripts from a Hansard XML URL.
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
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                Load Transcript
              </Button>
            </div>
             <p className="text-xs text-muted-foreground">
                Example: <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{url} <ExternalLink className="inline-block h-3 w-3" /></a>
            </p>
          </CardContent>
        </Card>
        
        {data && (
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Debate Information</CardTitle>
                    <CardDescription>{data.meta.documentTitle}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <p><span className="font-semibold">Date:</span> {data.meta.Date}</p>
                    <p><span className="font-semibold">Parliament:</span> {data.meta.ParliamentNumber}</p>
                    <p><span className="font-semibold">Session:</span> {data.meta.SessionNumber}</p>
                    <p><span className="font-semibold">Volume:</span> {data.meta.VolumeNumber}</p>
                    <p><span className="font-semibold">Number:</span> {data.meta.NumberNumber}</p>
                </CardContent>
            </Card>
        )}
        
        {isLoading && (
            <div className="mt-6 flex justify-center items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Fetching and parsing transcript...</span>
            </div>
        )}

        {data && (
          <div className="mt-6 space-y-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="full-transcript">
                <AccordionTrigger>View Full Transcript</AccordionTrigger>
                <AccordionContent>
                  <pre className="whitespace-pre-wrap font-body text-sm bg-muted p-4 rounded-md max-h-[400px] overflow-auto">{fullTranscript}</pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={`Search ${filteredInterventions.length} interventions by keyword or speaker...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                />
            </div>
            
            {filteredInterventions.length > 0 ? filteredInterventions.map(renderIntervention) : (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No interventions match your search query.</p>
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
