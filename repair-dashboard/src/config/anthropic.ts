// Anthropic API configuration
// SECURITY: API key is now stored securely on the backend
export const ANTHROPIC_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.2,
  // Hardcoded to Netlify Functions path - frontend and backend on same domain
  // This eliminates environment variable confusion and ensures reliable deployment
  backendUrl: '/.netlify/functions/api'
};

export const validateConfig = (): boolean => {
  return !!ANTHROPIC_CONFIG.backendUrl;
};
