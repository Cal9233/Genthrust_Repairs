// Anthropic API configuration
export const ANTHROPIC_CONFIG = {
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.2,
  apiUrl: 'https://api.anthropic.com/v1/messages'
};

export const validateApiKey = (): boolean => {
  return !!ANTHROPIC_CONFIG.apiKey && ANTHROPIC_CONFIG.apiKey.startsWith('sk-ant-');
};
