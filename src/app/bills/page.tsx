
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileText, Loader2, ServerCrash, ExternalLink, Filter, Info, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBillsData } from './actions';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Bill {
    Parliament: number;
    Session: number;
    BillNumberCode: string;
    BillTitle: {
        En: string;
        Fr: string;
    };
    BillType: string;
    Status: string;
    LastUpdated: string;
    IntroducedDate: string;
    Url: string;
}

export default function BillsPage() {
    const [bills, setBills] = useState<Bill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string[]>([]);
    const [rawHtml, setRawHtml] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            setError(null);
            setDebugInfo([]);
            setRawHtml(null);
            try {
                const data = await getBillsData();
                if(data.debug) {
                    setDebugInfo(data.debug);
                }
                if (data.rawHtml) {
                    setRawHtml(data.rawHtml);
                }
                if (data.error) {
                    throw new Error(data.error);
                }
                // The data is now nested under a 'Bills' key from our parser
                setBills(data.Bills || []);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setError(errorMessage);
                toast({
                    variant: 'destructive',
                    title: 'Failed to load bills',
                    description: errorMessage,
                });
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [toast]);

    const filteredBills = bills.filter(bill => {
        const searchTerm = filter.toLowerCase();
        return (
            bill.BillNumberCode.toLowerCase().includes(searchTerm) ||
            bill.BillTitle.En.toLowerCase().includes(searchTerm) ||
            bill.Status.toLowerCase().includes(searchTerm)
        );
    });
    
    const getStatusBadgeVariant = (status: string) => {
        if (status.toLowerCase().includes('royal assent')) return 'default';
        if (status.toLowerCase().includes('defeated')) return 'destructive';
        return 'secondary';
    }


    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText />
                            Parliamentary Bills
                        </CardTitle>
                        <CardDescription>
                            A list of all active and completed bills for the current parliamentary session, sourced from OurCommons.ca Open Data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="relative mb-4">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={`Filter ${bills.length > 0 ? bills.length : ''} bills by number, title, or status...`}
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10 w-full"
                                disabled={isLoading || !!error}
                            />
                        </div>
                    </CardContent>
                </Card>

                {(debugInfo.length > 0 || rawHtml) && (
                    <Accordion type="single" collapsible className="w-full mt-6">
                        <AccordionItem value="debug-info">
                            <AccordionTrigger>
                                <span className="flex items-center gap-2"><Bug className="h-4 w-4" /> Debugging Information</span>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Scraping & Parsing Log</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
                                            {debugInfo.map((msg, index) => <li key={index}>{msg}</li>)}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                                {rawHtml && (
                                    <Alert className="mt-4" variant="destructive">
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>Raw HTML Source</AlertTitle>
                                        <AlertDescription>
                                            <p className="mb-2 text-xs">The following HTML was scraped. The scraper may have failed to find the data link within this content.</p>
                                            <pre className="mt-2 whitespace-pre-wrap text-xs bg-muted p-4 rounded-md max-h-[400px] overflow-auto">
                                                {rawHtml}
                                            </pre>
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}

                {isLoading && (
                    <div className="mt-6 flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-lg">Fetching latest bill data...</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="mt-6 border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Data Unavailable</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90">{error}</p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve the bill information from the parliamentary source. Please check the debug logs above for more details on which URL was used and where the process may have failed. Try refreshing the page to attempt the fetch again.</p>
                        </CardContent>
                      </Card>
                )}

                {!isLoading && !error && (
                    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredBills.map(bill => (
                            <Card key={bill.BillNumberCode} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-lg">{bill.BillNumberCode}</CardTitle>
                                    <CardDescription>{bill.BillTitle.En}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm flex-grow">
                                     <p>
                                        <span className="font-semibold">Introduced:</span> {new Date(bill.IntroducedDate).toLocaleDateString()}
                                    </p>
                                    <p>
                                        <span className="font-semibold">Last Update:</span> {new Date(bill.LastUpdated).toLocaleDateString()}
                                    </p>
                                     <div className="flex items-center gap-2">
                                        <span className="font-semibold">Status:</span>
                                        <Badge variant={getStatusBadgeVariant(bill.Status)}>{bill.Status}</Badge>
                                    </div>
                                    <p>
                                        <span className="font-semibold">Type:</span> {bill.BillType}
                                    </p>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild variant="outline" size="sm" className="w-full">
                                        <a href={`https://www.parl.ca${bill.Url}`} target="_blank" rel="noopener noreferrer">
                                            View on PARL.ca
                                            <ExternalLink className="ml-2 h-4 w-4" />
                                        </a>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                         {filteredBills.length === 0 && bills.length > 0 && (
                            <div className="text-center py-10 col-span-full">
                                <p className="text-muted-foreground">No bills match your filter.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
