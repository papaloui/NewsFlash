
import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import type { Article } from "@/lib/types";

// Helper to safely get a value from a deeply nested object
const get = (obj: any, path: string, defaultValue: any = null) => {
    const value = path.split('.').reduce((acc, c) => (acc && acc[c]) ? acc[c] : undefined, obj);
    return value === undefined ? defaultValue : value;
};


const parseArticle = (item: any, channel: any): Article | null => {
    // Standardize how we get the title. Some feeds use 'title', others use 'media:title'.
    // It can also be an object with a '#text' property.
    const titleObj = get(item, 'title', get(item, 'media:title'));
    const title = typeof titleObj === 'object' ? titleObj['#text'] : titleObj;

    // Standardize how we get the link. Some use 'link', others use 'guid'.
    // A link can be an object with an '@_href' attribute or a simple string.
    let link: string | null = null;
    const linkObj = get(item, 'link');
    if (typeof linkObj === 'object' && linkObj !== null) {
        link = linkObj['@_href'] || get(linkObj, '#text');
    } else if (typeof linkObj === 'string') {
        link = linkObj;
    }
    // Fallback to guid if link is not found
    if (!link) {
        const guidObj = get(item, 'guid');
        link = (typeof guidObj === 'object' ? get(guidObj, '#text') : guidObj) || null;
    }

    // Skip if essential data is missing
    if (!title || !link) return null;

    // Standardize publication date parsing
    const pubDateString = get(item, 'pubDate', get(item, 'published'));
    let publicationDate: string;
    try {
        publicationDate = pubDateString ? new Date(pubDateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric'}) : new Date().toISOString();
    } catch (e) {
        publicationDate = new Date().toISOString();
    }

    // Standardize description/summary parsing, which is the most common source of the error.
    const summaryObj = get(item, 'description', get(item, 'media:description'));
    let summary = 'No summary available.';
    if (typeof summaryObj === 'object' && summaryObj !== null) {
        summary = summaryObj['#text'] || '';
    } else if (typeof summaryObj === 'string') {
        summary = summaryObj;
    }
    
    // Clean up summary (remove HTML tags and extra whitespace)
    const cleanedSummary = summary.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    
    // Ensure the source title is also a plain string
    const channelTitleObj = get(channel, 'title');
    const source = typeof channelTitleObj === 'object' ? channelTitleObj['#text'] : channelTitleObj || 'Unknown Source';

    return {
        headline: title,
        link: link,
        summary: cleanedSummary || 'No summary available.',
        source: source,
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
        isArray: (name, jpath, isLeafNode, isAttribute) => {
            // Ensure items/entries are always arrays
            return name === "item" || name === "entry";
        }
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

            const items = get(channel, 'item', get(channel, 'entry', []));

            items.forEach((item: any) => {
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
    allArticles.sort((a, b) => {
        try {
            return new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime();
        } catch (e) {
            return 0; // Don't sort if dates are invalid
        }
    });

    return NextResponse.json(allArticles);
}
