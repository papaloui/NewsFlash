
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Building, Loader2, ServerCrash, ExternalLink, User, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getOntarioBills, type OntarioBill } from './actions';

export default function OntarioBillsPage() {
    const [bills, setBills] = useState<OntarioBill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rawHtml, setRawHtml] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            setError(null);
            setRawHtml(null);
            try {
                const data = await getOntarioBills();
                if ('error' in data) {
                    if (data.html) {
                        setRawHtml(data.html);
                    }
                    throw new Error(data.error);
                }
                setBills(data.bills);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setError(errorMessage);
                toast({
                    variant: 'destructive',
                    title: 'Failed to load Ontario bills',
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
            bill.billNumber.toLowerCase().includes(searchTerm) ||
            bill.title.toLowerCase().includes(searchTerm) ||
            bill.sponsors.some(s => s.toLowerCase().includes(searchTerm))
        );
    });

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto p-4 md:p-6">
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building />
                            Ontario Legislative Bills
                        </CardTitle>
                        <CardDescription>
                            A list of all active bills for the current session of the Ontario Legislative Assembly. Sourced from ola.org.
                        </CardDescription>
                    </CardHeader>
                     <CardContent>
                        <div className="relative flex-grow">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={`Filter ${bills.length > 0 ? bills.length : ''} bills...`}
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10 w-full"
                                disabled={isLoading || !!error}
                            />
                        </div>
                    </CardContent>
                </Card>

                {isLoading && (
                    <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-lg">Fetching latest bill data from OLA...</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Data Unavailable</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90">{error}</p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve the bill information from the OLA source. This may be a temporary issue with the data source or a change in the page structure.</p>
                          {rawHtml && (
                            <div className="mt-4">
                                <h3 className="font-semibold">Raw HTML Content of Page:</h3>
                                <pre className="mt-2 p-4 bg-muted/50 rounded-md text-xs overflow-auto max-h-96">
                                    <code>{rawHtml}</code>
                                </pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                )}

                {!isLoading && !error && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredBills.map(bill => (
                            <Card key={bill.billNumber} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-bold">Bill {bill.billNumber}</CardTitle>
                                    </div>
                                    <CardDescription>{bill.title}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm flex-grow">
                                     <div className="flex items-start gap-2">
                                        <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div>
                                            <span className="font-semibold">Sponsor(s):</span>
                                            <ul className="list-disc pl-5">
                                                {bill.sponsors.map(s => <li key={s}>{s}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild variant="outline" size="sm" className="w-full">
                                        <a href={bill.link} target="_blank" rel="noopener noreferrer">
                                            View on OLA.org
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
