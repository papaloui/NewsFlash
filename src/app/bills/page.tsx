
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileText, Loader2, ServerCrash, ExternalLink, Filter, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBillsData } from './actions';
import { Input } from '@/components/ui/input';

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
    const [filter, setFilter] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getBillsData();
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
            (bill.BillNumberCode && bill.BillNumberCode.toLowerCase().includes(searchTerm)) ||
            (bill.BillTitle?.En && bill.BillTitle.En.toLowerCase().includes(searchTerm)) ||
            (bill.Status && bill.Status.toLowerCase().includes(searchTerm))
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
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve the bill information from the parliamentary source. This may be a temporary issue with the data source. Try refreshing the page to attempt the fetch again.</p>
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
                                        <span className="font-semibold">Introduced:</span> {bill.IntroducedDate ? new Date(bill.IntroducedDate).toLocaleDateString() : 'N/A'}
                                    </p>
                                    <p>
                                        <span className="font-semibold">Last Update:</span> {bill.LastUpdated ? new Date(bill.LastUpdated).toLocaleDateString() : 'N/A'}
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
