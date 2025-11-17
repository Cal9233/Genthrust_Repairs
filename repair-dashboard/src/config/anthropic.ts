// Anthropic API configuration
// SECURITY: API key is now stored securely on the backend
export const ANTHROPIC_CONFIG = {
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096,
  temperature: 0.7,
  // Backend proxy URL - API key is handled server-side
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
};

export const validateConfig = (): boolean => {
  return !!ANTHROPIC_CONFIG.backendUrl;
};
