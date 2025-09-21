
import { Header } from '@/components/app/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileText, ServerCrash, ExternalLink, Filter, User, Calendar, Activity, FileType, Newspaper, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBillsData } from './actions';
import { BillsClient } from './client';

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

export default async function BillsPage() {
    const data = await getBillsData();

    if (data.error) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto p-4 md:p-6">
                    <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Data Unavailable</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90">{data.error}</p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve the bill information from the parliamentary source. This may be a temporary issue with the data source. Please try again later.</p>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }
    
    const sortedBills = (data.Bills || []).sort((a: Bill, b: Bill) => {
        const dateA = a.LatestActivityDateTime ? new Date(a.LatestActivityDateTime).getTime() : 0;
        const dateB = b.LatestActivityDateTime ? new Date(b.LatestActivityDateTime).getTime() : 0;
        return dateB - dateA;
    });

    const sessionInfo = sortedBills.length > 0 ? `${sortedBills[0].ParliamentNumber}th Parliament, ${sortedBills[0].SessionNumber}st Session` : 'current parliamentary session';

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
                            A list of all active and completed bills for the {sessionInfo}. Sourced from OurCommons.ca.
                        </CardDescription>
                    </CardHeader>
                </Card>
                
                <BillsClient initialBills={sortedBills} />

            </main>
        </div>
    );
}
