import '@testing-library/jest-dom';
import { expect, afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { setupServer } from 'msw/node';
import { graphAPIHandlers, configureMockAPI } from './msw-handlers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Setup MSW server
export const server = setupServer(...graphAPIHandlers);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers and mock data after each test
afterEach(() => {
  server.resetHandlers();
  configureMockAPI.reset();
  cleanup();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
