import serverless from 'serverless-http';
import appImport from '../../backend/app.js';

// Defensive unwrapping - handles single and double wrapping
let app = appImport;

// Peel back the first layer (ES Module Default)
if (app.default) {
  app = app.default;
}

// Peel back a potential second layer (Bundler Artifact)
if (app.default) {
  app = app.default;
}

// Final validation - Express apps must have .use() method
if (!app || typeof app.use !== 'function') {
  console.error('[Netlify] CRITICAL ERROR: Express app not found in import');
  console.error('[Netlify] Import structure:', Object.keys(appImport || {}));
  throw new Error('Unsupported framework: Express app not found');
}

export const handler = serverless(app);
console.log('[Netlify] Handler initialized successfully');