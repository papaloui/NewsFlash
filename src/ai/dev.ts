import { config } from 'dotenv';
config();

import '@/ai/flows/rank-articles-by-relevance.ts';
import '@/ai/flows/summarize-article.ts';
import '@/ai/flows/summarize-headline.ts';