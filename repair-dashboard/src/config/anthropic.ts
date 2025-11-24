// Anthropic API configuration
// SECURITY: API key is now stored securely on the backend
export const ANTHROPIC_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.2,
  // Backend proxy URL - API key is handled server-side
  // VITE_BACKEND_URL should be the full API path (e.g., /.netlify/functions/api or http://localhost:3001)
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
};

export const validateConfig = (): boolean => {
  return !!ANTHROPIC_CONFIG.backendUrl;
};
