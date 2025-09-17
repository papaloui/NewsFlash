import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-pro',
  prompt: {
    // Add a custom helper to stringify JSON in prompts.
    helpers: {
      jsonStringify: (obj: any) => JSON.stringify(obj),
    },
  },
});
