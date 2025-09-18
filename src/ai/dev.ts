
'use server';

import { config } from 'dotenv';
config();

import '@/ai/flows/rank-articles-by-relevance.ts';
import '@/ai/flows/search-news-and-rank.ts';
import '@/ai/flows/summarize-headlines-digest.ts';
import '@/ai/flows/summarize-hansard-transcript.ts';
import '@/ai/flows/hansard-agent.ts';
import '@/ai/flows/summarize-articles.ts';
import '@/ai/flows/summarize-bills.ts';
import '@/ai/flows/news-agent.ts';
import '@/ai/flows/summarize-gazette.ts';
import '@/ai/flows/summarize-ontario-debate.ts';
import '@/ai/flows/summarize-ontario-gazette.ts';


