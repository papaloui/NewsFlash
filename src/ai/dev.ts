'use server';

import { config } from 'dotenv';
config();

import '@/ai/flows/rank-articles-by-relevance.ts';
import '@/ai/flows/summarize-article.ts';
import '@/ai/flows/summarize-headline.ts';
import '@/ai/flows/search-news-and-rank.ts';
import '@/ai/flows/summarize-headlines-digest.ts';
import '@/ai/flows/news-agent.ts';
import '@/ai/flows/summarize-hansard-transcript.ts';
import '@/ai/flows/hansard-agent.ts';
