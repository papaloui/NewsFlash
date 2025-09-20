
import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import type { Article } from "@/lib/types";

// Helper to safely get a value from a deeply nested object
const get = (obj: any, path: string, defaultValue: any = null) => {
    const value = path.split('.').reduce((acc, c) => (acc && acc[c]) ? acc[c] : undefined, obj);
    return value === undefined ? defaultValue : value;
};


const parseArticle = (item: any, channel: any): Article | null => {
    const title = get(item, 'title', get(item, 'media:title.#text'));
    const link = get(item, 'link', get(item, 'guid.#text'));
    
    // Skip if essential data is missing
    if (!title || !link) return null;

    // Standardize publication date parsing
    const pubDate = get(item, 'pubDate', get(item, 'published'));
    const publicationDate = pubDate ? new Date(pubDate).toLocaleDateString() : new Date().toLocaleDateString();

    // Standardize description/summary parsing
    const summary = get(item, 'description', get(item, 'media:description.#text', 'No summary available.'));
    
    // Clean up summary (remove HTML tags)
    const cleanedSummary = summary.replace(/<[^>]+>/g, '').trim();

    return {
        headline: title,
        link: link,
        summary: cleanedSummary,
        source: get(channel, 'title', 'Unknown Source'),
        publicationDate,
    };
};


export async function POST(req: NextRequest) {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json({ error: "Please provide an array of RSS feed URLs." }, { status: 400 });
    }

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseTagValue: true,
        parseAttributeValue: true,
        trimValues: true,
        textNodeName: "#text",
    });

    const allArticles: Article[] = [];

    const fetchPromises = urls.map(async (url) => {
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'NewsFlash/1.0' } });
            if (!response.ok) {
                console.warn(`Failed to fetch RSS feed from ${url}: Status ${response.status}`);
                return; // Skip this feed
            }
            const xml = await response.text();
            const result = parser.parse(xml);
            
            const channel = get(result, 'rss.channel', get(result, 'feed'));
            if (!channel) return;

            const items = Array.isArray(channel.item) ? channel.item : 
                          Array.isArray(channel.entry) ? channel.entry :
                          [];

            items.forEach(item => {
                const article = parseArticle(item, channel);
                if (article) {
                    allArticles.push(article);
                }
            });

        } catch (error) {
            console.error(`Error processing RSS feed from ${url}:`, error);
        }
    });

    await Promise.all(fetchPromises);
    
    // Sort articles by publication date, newest first
    allArticles.sort((a, b) => new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime());

    return NextResponse.json(allArticles);
}
