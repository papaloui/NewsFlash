
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/app/header';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileText, Loader2, ServerCrash, ExternalLink, Filter, User, Calendar, Activity, FileType, Newspaper, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBillsData, summarizeBillsFromYesterday } from './actions';
import { Input } from '@/components/ui/input';

interface Bill {
    BillId: number;
    BillNumberFormatted: string;
    LongTitleEn: string;
    LatestCompletedMajorStageEn: string;
    BillTypeEn: string;
    CurrentStatusEn: string;
    SponsorEn: string;
    LatestActivityEn: string;
    LatestActivityDateTime: string;
    ParliamentNumber: number;
    SessionNumber: number;
    LatestBillTextTypeId: number;
}

export default function BillsPage() {
    const [bills, setBills] = useState<Bill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
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
                const sortedBills = (data.Bills || []).sort((a: Bill, b: Bill) => {
                    return new Date(b.LatestActivityDateTime).getTime() - new Date(a.LatestActivityDateTime).getTime();
                });
                setBills(sortedBills);
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

    const handleSummarize = async () => {
        setIsSummarizing(true);
        setSummary(null);
        try {
            const result = await summarizeBillsFromYesterday(bills);
            if ('error' in result) {
                throw new Error(result.error);
            }
            setSummary(result.summary);
        } catch (err) {
             const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
             toast({
                variant: 'destructive',
                title: 'Summarization Failed',
                description: errorMessage,
            });
        } finally {
            setIsSummarizing(false);
        }
    };

    const filteredBills = bills.filter(bill => {
        const searchTerm = filter.toLowerCase();
        return (
            (bill.BillNumberFormatted && bill.BillNumberFormatted.toLowerCase().includes(searchTerm)) ||
            (bill.LongTitleEn && bill.LongTitleEn.toLowerCase().includes(searchTerm)) ||
            (bill.CurrentStatusEn && bill.CurrentStatusEn.toLowerCase().includes(searchTerm)) ||
            (bill.SponsorEn && bill.SponsorEn.toLowerCase().includes(searchTerm)) ||
            (bill.LatestActivityEn && bill.LatestActivityEn.toLowerCase().includes(searchTerm))
        );
    });
    
    const getStatusBadgeVariant = (status: string) => {
        const lowerStatus = status ? status.toLowerCase() : '';
        if (lowerStatus.includes('royal assent')) return 'default';
        if (lowerStatus.includes('defeated') || lowerStatus.includes('negatived')) return 'destructive';
        if (lowerStatus.includes('reading') || lowerStatus.includes('introduced')) return 'secondary';
        return 'outline';
    }


    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto p-4 md:p-6">
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText />
                            Parliamentary Bills
                        </CardTitle>
                        <CardDescription>
                            A list of all active and completed bills for the {bills.length > 0 ? `${bills[0].ParliamentNumber}th Parliament, ${bills[0].SessionNumber}st Session` : 'current parliamentary session'}. Sourced from OurCommons.ca.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="flex flex-col sm:flex-row gap-4">
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
                            <Button onClick={handleSummarize} disabled={isSummarizing || isLoading || bills.length === 0}>
                                {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Summarize Yesterday's Bills
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {isSummarizing && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><Newspaper/> Yesterday's Bill Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <p>Generating summary from yesterday's updated bills...</p>
                        </CardContent>
                    </Card>
                )}

                {summary && (
                     <Card className="mb-6 bg-primary/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><Newspaper/> Yesterday's Bill Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-wrap font-body text-sm leading-relaxed">{summary}</p>
                        </CardContent>
                    </Card>
                )}

                {isLoading && (
                    <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-lg">Fetching latest bill data...</span>
                    </div>
                )}

                {error && !isLoading && (
                     <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Data Unavailable</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90">{error}</p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve the bill information from the parliamentary source. This may be a temporary issue with the data source. Please try again later.</p>
                        </CardContent>
                      </Card>
                )}

                {!isLoading && !error && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredBills.map(bill => (
                            <Card key={bill.BillId} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-bold">{bill.BillNumberFormatted}</CardTitle>
                                        {bill.CurrentStatusEn && <Badge variant={getStatusBadgeVariant(bill.CurrentStatusEn)}>{bill.CurrentStatusEn}</Badge>}
                                    </div>
                                    <CardDescription>{bill.LongTitleEn}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm flex-grow">
                                     <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-semibold">Sponsor:</span> {bill.SponsorEn}
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div>
                                            <span className="font-semibold">Latest Activity:</span> {bill.LatestActivityEn}
                                        </div>
                                    </div>
                                     <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-semibold">Last Update:</span> {new Date(bill.LatestActivityDateTime).toLocaleDateString()}
                                    </div>
                                    <p>
                                        <span className="font-semibold">Stage:</span> {bill.LatestCompletedMajorStageEn}
                                    </p>
                                    <p>
                                        <span className="font-semibold">Type:</span> {bill.BillTypeEn}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex-col sm:flex-row gap-2 items-center">
                                    <Button asChild variant="outline" size="sm" className="w-full">
                                        <a href={`https://www.parl.ca/legisinfo/en/bill/${bill.ParliamentNumber}-${bill.SessionNumber}/${bill.BillNumberFormatted.toLowerCase()}`} target="_blank" rel="noopener noreferrer">
                                            View on PARL.ca
                                            <ExternalLink className="ml-2 h-4 w-4" />
                                        </a>
                                    </Button>
                                    <Button asChild variant="secondary" size="sm" className="w-full">
                                        <a 
                                            href={`https://www.parl.ca/Content/Bills/${bill.ParliamentNumber}${bill.SessionNumber}/Private/${bill.BillNumberFormatted.replace('-', '')}/${bill.BillNumberFormatted.replace('-', '')}_1/${bill.BillNumberFormatted.replace('-', '')}_E.xml`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                        >
                                            View Bill Text
                                            <FileType className="ml-2 h-4 w-4" />
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
