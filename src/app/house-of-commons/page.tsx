
import { Header } from '@/components/app/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, ServerCrash } from 'lucide-react';
import { getSittingDates } from './actions';
import { HouseOfCommonsClient } from './client';

export default async function HouseOfCommonsPage() {
    const { dates, error } = await getSittingDates();

    if (error) {
         return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto p-4 md:p-6">
                    <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Calendar Data Unavailable</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90">{error}</p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve the sitting dates from the parliamentary source. This may be a temporary issue with the data source. Please try again later.</p>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto p-4 md:p-6">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Landmark />
                      House of Commons Debates
                    </CardTitle>
                    <CardDescription>
                      Select a sitting date from the calendar to load and analyze a parliamentary transcript.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <HouseOfCommonsClient allSittingDates={dates} />
            </main>
        </div>
    )
}
