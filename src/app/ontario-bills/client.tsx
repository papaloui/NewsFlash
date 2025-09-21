
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ExternalLink, User, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OntarioBill } from './actions';

export function OntarioBillsClient({ bills }: { bills: OntarioBill[] }) {
    const [filter, setFilter] = useState('');

    const filteredBills = bills.filter(bill => {
        const searchTerm = filter.toLowerCase();
        return (
            bill.billNumber.toLowerCase().includes(searchTerm) ||
            bill.title.toLowerCase().includes(searchTerm) ||
            bill.sponsors.some(s => s.toLowerCase().includes(searchTerm))
        );
    });

    return (
        <div>
            <div className="relative mb-6">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={`Filter ${bills.length} bills...`}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-10 w-full"
                />
            </div>

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
                                    {bill.sponsors.length > 0 ? (
                                        <ul className="list-disc pl-5">
                                            {bill.sponsors.map(s => <li key={s}>{s}</li>)}
                                        </ul>
                                    ) : (
                                        <span> N/A</span>
                                    )}
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
        </div>
    );
}
