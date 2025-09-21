
import { Header } from '@/components/app/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, ServerCrash } from 'lucide-react';
import { getOntarioBills } from './actions';
import { OntarioBillsClient } from './client';

export default async function OntarioBillsPage() {
    const { bills, error, html } = await getOntarioBills();

    if (error || !bills) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto p-4 md:p-6">
                    <Card className="border-destructive">
                        <CardHeader>
                          <CardTitle className='text-destructive flex items-center gap-2'><ServerCrash/> Data Unavailable</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-destructive/90 mb-2 font-semibold">URL Requested: <span className="font-normal text-muted-foreground">https://www.ola.org/en/legislative-business/bills/parliament-44/session-1/</span></p>
                          <p className="text-destructive/90 font-semibold">Error Message: <span className="font-normal text-muted-foreground">{error}</span></p>
                          <p className="text-sm text-muted-foreground mt-2">Could not retrieve the bill information from the OLA source. This may be a temporary issue with the data source or a change in the page structure.</p>
                          {html && (
                            <div className="mt-4">
                                <h3 className="font-semibold">Raw HTML Content of Page:</h3>
                                <pre className="mt-2 p-4 bg-muted/50 rounded-md text-xs overflow-auto max-h-96 border">
                                    <code>{html}</code>
                                </pre>
                            </div>
                          )}
                        </CardContent>
                    </Card>
                </main>
            </div>
        )
    }

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
                </Card>
                <OntarioBillsClient bills={bills} />
            </main>
        </div>
    );
}
