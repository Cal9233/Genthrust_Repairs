import { aiConfig } from '../config/ai';
import type { AIParserResponse } from '../types/aiCommand';

/**
 * AI Parser Service
 *
 * Uses OpenAI to parse natural language commands into structured actions
 */
class AIParserService {
  private apiKey: string;

  constructor() {
    this.apiKey = aiConfig.openai.apiKey;
  }

  /**
   * Parse natural language text into a structured command
   */
  async parseCommand(text: string): Promise<AIParserResponse> {
    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your .env file'
      );
    }

    if (!aiConfig.features.enabled) {
      throw new Error('AI command parsing is disabled');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(text);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: aiConfig.openai.temperature,
          max_tokens: aiConfig.openai.maxTokens,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content) as AIParserResponse;

      // Validate and normalize the response
      return this.validateAndNormalize(parsed);
    } catch (error: any) {
      console.error('[AIParser] Error:', error);
      throw new Error(`Failed to parse command: ${error.message}`);
    }
  }

  /**
   * Build the system prompt that instructs the AI how to parse commands
   */
  private buildSystemPrompt(): string {
    return `You are an AI assistant that parses natural language commands for a repair order management system.

Your job is to extract structured information from user commands and return a JSON object.

Available actions:
- update_status: Change the status of an RO
- set_scheduled_date: Set a scheduled completion date
- add_note: Add a note to an RO
- set_cost: Update cost information
- set_reminder: Set a reminder for a specific date
- update_multiple_fields: Update multiple fields at once
- unknown: When the command is unclear

Common status values:
- WAITING QUOTE
- QUOTE RECEIVED
- APPROVED
- BEING REPAIRED
- SHIPPING
- RECEIVED
- PAYMENT SENT
- PAID
- BER (Beyond Economic Repair)
- TO SEND

Date formats to recognize:
- MM/DD/YY (e.g., 11/18/25)
- MM/DD/YYYY (e.g., 11/18/2025)
- Month DD, YYYY (e.g., November 18, 2025)
- Relative dates (e.g., "tomorrow", "next week", "in 3 days")

RO number formats:
- Can start with letters (G, RO, etc.) followed by numbers
- Can be just numbers
- Extract the full RO identifier

Return a JSON object with this structure:
{
  "action": "update_status" | "set_scheduled_date" | "add_note" | "set_cost" | "set_reminder" | "update_multiple_fields" | "unknown",
  "roNumber": "extracted RO number or null if not found",
  "params": {
    "status": "optional status value",
    "scheduledCompletionDate": "optional ISO date string",
    "estimatedDeliveryDate": "optional ISO date string",
    "nextUpdateDate": "optional ISO date string",
    "cost": optional number,
    "notes": "optional note text",
    "reminderDate": "optional ISO date string",
    "reminderNote": "optional reminder note",
    "fields": {} // optional object for multiple fields
  },
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of your parsing"
}

Examples:
Input: "RO G38462 Scheduled Completion Date: 11/18/25"
Output: {
  "action": "set_scheduled_date",
  "roNumber": "G38462",
  "params": {
    "scheduledCompletionDate": "2025-11-18"
  },
  "confidence": 0.95,
  "reasoning": "Clear RO number and date provided"
}

Input: "Update RO 12345 status to being repaired, estimated cost $2500"
Output: {
  "action": "update_multiple_fields",
  "roNumber": "12345",
  "params": {
    "status": "BEING REPAIRED",
    "cost": 2500,
    "fields": {
      "status": "BEING REPAIRED",
      "cost": 2500
    }
  },
  "confidence": 0.9,
  "reasoning": "Multiple fields to update: status and cost"
}

Input: "Set reminder for G38462 on 11/20/25"
Output: {
  "action": "set_reminder",
  "roNumber": "G38462",
  "params": {
    "reminderDate": "2025-11-20",
    "reminderNote": "Follow up on RO G38462"
  },
  "confidence": 0.9,
  "reasoning": "Clear reminder date and RO number"
}

Always be conservative with confidence scores. If unsure, return lower confidence and explain in reasoning.`;
  }

  /**
   * Build the user prompt with the command text
   */
  private buildUserPrompt(text: string): string {
    return `Parse this command: "${text}"

Return the JSON object with the parsed information.`;
  }

  /**
   * Validate and normalize the AI response
   */
  private validateAndNormalize(response: AIParserResponse): AIParserResponse {
    // Ensure required fields exist
    if (!response.action) {
      response.action = 'unknown';
      response.confidence = 0;
    }

    if (!response.params) {
      response.params = {};
    }

    // Normalize status values to uppercase
    if (response.params.status) {
      response.params.status = response.params.status.toUpperCase();
    }

    // Validate confidence is between 0 and 1
    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      response.confidence = 0.5;
    }

    return response;
  }

  /**
   * Check if the AI service is configured and ready
   */
  isConfigured(): boolean {
    return !!this.apiKey && aiConfig.features.enabled;
  }

  /**
   * Get configuration status and helpful error message
   */
  getConfigStatus(): { configured: boolean; message: string } {
    if (!this.apiKey) {
      return {
        configured: false,
        message: 'OpenAI API key not set. Add VITE_OPENAI_API_KEY to your .env file.',
      };
    }

    if (!aiConfig.features.enabled) {
      return {
        configured: false,
        message: 'AI features are disabled in configuration.',
      };
    }

    return {
      configured: true,
      message: 'AI parser is ready to use.',
    };
  }
}

export const aiParserService = new AIParserService();
