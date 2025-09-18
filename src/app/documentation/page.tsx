
'use client';

import { Header } from '@/components/app/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileCode, Telescope, Target, Server, FileText, Landmark, Building, Rss, Link as LinkIcon, BookMarked } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FeatureCard = ({ title, icon, description, children }: { title: string, icon: React.ReactNode, description: string, children: React.ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-3">
                {icon}
                {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
            {children}
        </CardContent>
    </Card>
);

const Section = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">{icon} {title}</h3>
        <div className="text-sm text-muted-foreground space-y-2 pl-7">{children}</div>
    </div>
);


export default function DocumentationPage() {

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto p-4 md:p-6">
                <Card className="mb-6 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-2xl">
                            <FileCode />
                            Application Documentation & Roadmap
                        </CardTitle>
                        <CardDescription>
                            A detailed breakdown of how each feature in the NewsFlash application works, the data sources it relies on, and potential improvements for the future.
                        </CardDescription>
                    </CardHeader>
                </Card>

                <div className="space-y-6">
                    <FeatureCard title="Ontario Debates Summarizer" icon={<FileText />} description="Summarizes legislative debates from the Legislative Assembly of Ontario.">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>View Details</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <Section title="Current Logic" icon={<Target />}>
                                        <p>The feature currently fetches a single, hardcoded PDF of a debate transcript from a specific URL. It then passes this PDF directly to the Gemini 1.5 Flash AI model for summarization.</p>
                                        <div className="flex items-start gap-2">
                                            <LinkIcon className="h-4 w-4 mt-1" />
                                            <div>
                                                <span className="font-semibold">Hardcoded URL:</span>
                                                <p className="break-all text-xs">https://www.ola.org/sites/default/files/node-files/hansard/document/pdf/2025/2025-06/05-JUN-2025_L023_0.pdf</p>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Technology Stack" icon={<Server />}>
                                        <p>The server action fetches the PDF, converts it to a Base64 data URI, and sends it to an AI flow.</p>
                                        <p>The AI flow (`summarize-ontario-debate.ts`) uses <Badge variant="secondary">Gemini 1.5 Flash</Badge> to process the entire PDF document and generate a summary.</p>
                                    </Section>
                                    <Section title="Future Roadmap" icon={<Telescope />}>
                                        <p>
                                            <span className="font-semibold text-foreground">1. Generalize Debate Fetching:</span> Instead of a hardcoded URL, build a web scraper to find the latest debate PDF from the main Hansard page on ola.org.
                                        </p>
                                        <p>
                                            <span className="font-semibold text-foreground">2. Full Automation:</span> Create a system that automatically checks for new debates daily, fetches them, and generates summaries without user interaction.
                                        </p>
                                         <p>
                                            <span className="font-semibold text-foreground">3. Historical Access:</span> Allow users to select a date to view past debate summaries.
                                        </p>
                                    </Section>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </FeatureCard>
                    
                    <FeatureCard title="House of Commons" icon={<Landmark />} description="Fetches, analyzes, and summarizes debates from the Canadian House of Commons.">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>View Details</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <Section title="Current Logic" icon={<Target />}>
                                        <p>This feature has an automated and a manual path:</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><span className="font-semibold">Automated:</span> The system checks the official sitting calendar for a specific hardcoded date ('2025-09-17'). If the house was sitting, it navigates through several pages to find the Hansard XML link for that day and automatically loads it. (Currently disabled).</li>
                                            <li><span className="font-semibold">Manual:</span> A user can paste any Hansard XML URL to load and summarize the transcript.</li>
                                            <li>Once loaded, the XML is parsed into a structured format and a full text transcript is generated. This transcript is sent to a long-running AI job for summarization. The frontend polls every 5 seconds to check for completion. After summarization, a chat interface allows users to ask questions about the debate.</li>
                                        </ul>
                                         <div className="flex items-start gap-2">
                                            <LinkIcon className="h-4 w-4 mt-1" />
                                            <div>
                                                <span className="font-semibold">Key URLs:</span>
                                                <p className="break-all text-xs">Sitting Calendar: https://www.ourcommons.ca/en/sitting-calendar</p>
                                                <p className="break-all text-xs">Daily Business: https://www.ourcommons.ca/en/parliamentary-business/[YYYY-MM-DD]</p>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Technology Stack" icon={<Server />}>
                                        <p>Uses <Badge variant="secondary">JSDOM</Badge> for scraping calendar and business pages. Uses <Badge variant="secondary">fast-xml-parser</Badge> to parse the Hansard XML.</p>
                                        <p>The AI flow (`summarize-hansard-transcript.ts`) uses <Badge variant="secondary">Gemini 1.5 Flash</Badge> to generate a detailed summary, list of topics, and referenced bills. The chat agent (`hansard-agent.ts`) uses another prompt to answer questions based on the transcript and summary.</p>
                                    </Section>
                                    <Section title="Future Roadmap" icon={<Telescope />}>
                                        <p>
                                            <span className="font-semibold text-foreground">1. Interactive Calendar:</span> Implement a calendar UI where users can see all sitting days and click to view the summary for any past debate.
                                        </p>
                                        <p>
                                            <span className="font-semibold text-foreground">2. Speaker Analysis:</span> Add analytics to track how often each member speaks, their key topics, and sentiment.
                                        </p>
                                         <p>
                                            <span className="font-semibold text-foreground">3. Persistent Storage:</span> Store summaries in a database (like Firestore) to avoid re-generating them on each visit.
                                        </p>
                                    </Section>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </FeatureCard>

                    <FeatureCard title="Federal & Ontario Bills" icon={<Building />} description="Tracks legislative bills from both the federal and provincial levels.">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>View Details</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                     <Section title="Current Logic" icon={<Target />}>
                                        <p><span className="font-semibold">Federal Bills:</span> Fetches a master XML file from parl.ca containing all bills for the session. It also includes a feature to summarize bills updated "yesterday" by fetching the full text of each relevant bill and sending it to an AI flow.</p>
                                        <p><span className="font-semibold">Ontario Bills:</span> Scrapes the Legislative Assembly of Ontario website to get a list of current bills from an HTML table.</p>
                                         <div className="flex items-start gap-2">
                                            <LinkIcon className="h-4 w-4 mt-1" />
                                            <div>
                                                <span className="font-semibold">Key URLs:</span>
                                                <p className="break-all text-xs">Federal: https://www.parl.ca/legisinfo/en/bills/xml</p>
                                                <p className="break-all text-xs">Ontario: https://www.ola.org/en/legislative-business/bills/parliament-44/session-1/</p>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Technology Stack" icon={<Server />}>
                                        <p>Uses <Badge variant="secondary">fast-xml-parser</Badge> for federal bills and <Badge variant="secondary">JSDOM</Badge> for scraping the Ontario bills page.</p>
                                        <p>The `summarize-bills.ts` AI flow uses <Badge variant="secondary">Gemini</Badge> to create a report from the combined text of multiple bills.</p>
                                    </Section>
                                    <Section title="Future Roadmap" icon={<Telescope />}>
                                        <p>
                                            <span className="font-semibold text-foreground">1. Bill Text Summarization (Ontario):</span> Implement logic to fetch and summarize the actual text of Ontario bills, similar to the federal feature.
                                        </p>
                                        <p>
                                            <span className="font-semibold text-foreground">2. Bill Status Tracking:</span> Add a feature to track the legislative journey of a specific bill (e.g., first reading, royal assent) and show a timeline.
                                        </p>
                                         <p>
                                            <span className="font-semibold text-foreground">3. User Subscriptions:</span> Allow users to "watch" a bill and receive notifications about status changes.
                                        </p>
                                    </Section>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </FeatureCard>

                    <FeatureCard title="Canada Gazette Summarizer" icon={<BookMarked />} description="Summarizes the official newspaper of the Canadian government.">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>View Details</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                     <Section title="Current Logic" icon={<Target />}>
                                        <p>The action scrapes an index page on gazette.gc.ca to find a link to the latest Part I PDF. It was initially hardcoded to a specific date but has been updated to find a link containing "number 37" and ".pdf" to locate the correct file.</p>
                                         <div className="flex items-start gap-2">
                                            <LinkIcon className="h-4 w-4 mt-1" />
                                            <div>
                                                <span className="font-semibold">Key URL:</span>
                                                <p className="break-all text-xs">https://gazette.gc.ca/rp-pr/p1/2025/index-eng.html</p>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Technology Stack" icon={<Server />}>
                                        <p>Uses <Badge variant="secondary">JSDOM</Badge> to find the PDF link. The PDF is fetched and passed as a Base64 data URI to the `summarize-gazette.ts` AI flow.</p>
                                        <p>The AI flow leverages the multimodal capabilities of <Badge variant="secondary">Gemini 1.5 Flash</Badge> to understand the PDF directly without pre-processing.</p>
                                    </Section>
                                    <Section title="Future Roadmap" icon={<Telescope />}>
                                        <p>
                                            <span className="font-semibold text-foreground">1. Robust Link Finding:</span> Improve the scraper to be independent of issue numbers, perhaps by finding the most recent date link on the index page.
                                        </p>
                                        <p>
                                            <span className="font-semibold text-foreground">2. Structured Summaries:</span> Update the AI prompt to extract key information into a structured format (e.g., Proposed Regulations, Government Notices) instead of a single block of text.
                                        </p>
                                    </Section>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </FeatureCard>

                    <FeatureCard title="RSS News Reader" icon={<Rss />} description="Fetches and displays news from user-defined RSS feeds.">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>View Details</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                     <Section title="Current Logic" icon={<Target />}>
                                        <p>Users can create and manage "Collections" of RSS feed URLs. The application fetches all articles from the URLs in a selected collection via a custom API route (`/api/rss`), which parses the XML feeds.</p>
                                        <p>After fetching headlines, it then scrapes each article's origin page to get the full body content. This content is displayed in an accordion below the summary.</p>
                                    </Section>
                                    <Section title="Technology Stack" icon={<Server />}>
                                        <p>Collections are stored in the browser's <Badge variant="secondary">localStorage</Badge>. The RSS fetching uses <Badge variant="secondary">fast-xml-parser</Badge> on the backend. Article content scraping uses <Badge variant="secondary">@mozilla/readability</Badge>.</p>
                                        <p>The `summarize-headlines-digest.ts` flow can create a summary digest from multiple articles, though this is not currently enabled on the main page.</p>
                                    </Section>
                                     <Section title="Future Roadmap" icon={<Telescope />}>
                                        <p>
                                            <span className="font-semibold text-foreground">1. Enable Daily Digest:</span> Re-enable the `handleSummarizeDigest` function on the main page to provide an AI-powered summary of all fetched articles.
                                        </p>
                                        <p>
                                            <span className="font-semibold text-foreground">2. Caching:</span> Implement server-side caching for RSS feeds to improve performance and reduce redundant requests.
                                        </p>
                                        <p>
                                            <span className="font-semibold text-foreground">3. Article Summarization:</span> Add a button to summarize individual articles on demand, in addition to the full digest.
                                        </p>
                                    </Section>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </FeatureCard>
                </div>
            </main>
        </div>
    );
}

    