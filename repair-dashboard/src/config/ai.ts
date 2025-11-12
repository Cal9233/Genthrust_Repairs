/**
 * AI Configuration
 *
 * Configure your AI provider for natural language command parsing.
 * Currently supports OpenAI GPT models.
 */

export const aiConfig = {
  // AI Provider - currently only 'openai' is supported
  provider: 'openai' as const,

  // OpenAI Configuration
  openai: {
    // Get your API key from: https://platform.openai.com/api-keys
    // IMPORTANT: In production, use environment variables instead of hardcoding
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',

    // Model to use for command parsing
    model: 'gpt-4o-mini', // Fast and cost-effective for parsing

    // Maximum tokens for response
    maxTokens: 500,

    // Temperature (0-1, lower = more deterministic)
    temperature: 0.1,
  },

  // Feature flags
  features: {
    // Enable AI command parsing
    enabled: true,

    // Show AI confidence scores
    showConfidence: true,

    // Require confirmation before executing commands
    requireConfirmation: true,
  },
};

// Cost estimate per command (approximate)
export const costEstimate = {
  openai: {
    'gpt-4o-mini': 0.002, // ~$0.002 per command
    'gpt-4o': 0.01, // ~$0.01 per command
  },
};
