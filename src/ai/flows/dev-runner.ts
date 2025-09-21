
'use server';

/**
 * @fileoverview A dev-only flow that dynamically runs other flows.
 * This is used to speed up Genkit startup time by avoiding eager-loading all flows.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as flows from './index';

const DevRunnerInputSchema = z.object({
  flowName: z.string().describe('The name of the flow to run.'),
  input: z.any().describe('The input to pass to the flow.'),
});

type DevRunnerInput = z.infer<typeof DevRunnerInputSchema>;

// A simple map to get the flow function by name.
// In a real-world scenario, you might use a more dynamic import system.
const flowMap: Record<string, (input: any) => Promise<any>> = {
  ...flows,
};

ai.defineFlow(
  {
    name: 'devRunner',
    inputSchema: DevRunnerInputSchema,
    outputSchema: z.any(),
  },
  async ({ flowName, input }) => {
    console.log(`[Dev Runner] Received request to run flow: ${flowName}`);

    const flowToRun = flowMap[flowName];

    if (!flowToRun) {
      const availableFlows = Object.keys(flowMap).join(', ');
      throw new Error(
        `Flow "${flowName}" not found. Available flows: ${availableFlows}`
      );
    }

    try {
      console.log(`[Dev Runner] Executing flow "${flowName}" with input:`, input);
      const result = await flowToRun(input);
      console.log(`[Dev Runner] Flow "${flowName}" completed successfully.`);
      return result;
    } catch (error) {
      console.error(`[Dev Runner] Error executing flow "${flowName}":`, error);
      // Re-throw the error to ensure the caller gets the failure details.
      throw error;
    }
  }
);
