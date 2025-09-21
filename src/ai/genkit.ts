import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  model: 'googleai/gemini-1.5-flash',
  prompt: {
    // Add a custom helper to stringify JSON in prompts.
    helpers: {
      jsonStringify: (obj: any) => JSON.stringify(obj),
    },
  },
});
