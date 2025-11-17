import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Sparkles, Send, Loader2, User, Bot, Zap, MessageSquare, TrendingUp, Package, X, Mic, MicOff } from 'lucide-react';
import { useROs } from '@/hooks/useROs';
import { useShops } from '@/hooks/useShops';
import { anthropicAgent } from '@/services/anthropicAgent';
import type { CommandContext, AIMessage } from '@/types/aiAgent';
import { toast } from 'sonner';
import { useMsal } from '@azure/msal-react';
import { loggingService } from '@/lib/loggingService';
import { useQueryClient } from '@tanstack/react-query';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useLogger } from '@/utils/logger';

interface AIAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONVERSATION_STORAGE_KEY = 'genthrust-ai-conversation-history';
const MAX_STORED_MESSAGES = 50; // Limit stored messages to prevent localStorage overflow

export function AIAgentDialog({ open, onOpenChange }: AIAgentDialogProps) {
  const logger = useLogger('AIAgentDialog', { open });

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: ros = [] } = useROs();
  const { data: shops = [] } = useShops();
  const { accounts } = useMsal();
  const queryClient = useQueryClient();

  // Voice recognition
  const {
    transcript,
    isListening,
    isSupported: isVoiceSupported,
    error: voiceError,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceRecognition({ continuous: false, interimResults: true });

  // Helper to extract text content from message
  interface ContentBlock {
    type: string;
    text?: string;
  }

  const getMessageText = (content: string | ContentBlock[]): string => {
    if (typeof content === 'string') {
      return content;
    }
    // If it's an array of content blocks, extract text blocks
    return content
      .filter((block: ContentBlock) => block.type === 'text')
      .map((block: ContentBlock) => block.text || '')
      .join('\n');
  };

  // Load conversation history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Reconstruct Date objects
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
      }
    } catch (error) {
      logger.error('Failed to load conversation history', error as Error);
    }
  }, [logger]);

  // Save conversation history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        // Only store last MAX_STORED_MESSAGES messages
        const messagesToStore = messages.slice(-MAX_STORED_MESSAGES);
        localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(messagesToStore));
      } catch (error) {
        logger.error('Failed to save conversation history', error as Error, {
          messageCount: messages.length
        });
      }
    }
  }, [messages, logger]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

// Focus textarea when dialog opens
useEffect(() => {
  if (open) {
    textareaRef.current?.focus();
  }
}, [open]);

  // Update input when transcript changes
  useEffect(() => {
    if (transcript && !isListening) {
      // Only update when recording stops (final transcript)
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
      resetTranscript();
    }
  }, [transcript, isListening, resetTranscript]);

  // Show toast if voice error occurs
  useEffect(() => {
    if (voiceError) {
      toast.error(voiceError);
    }
  }, [voiceError]);

  const handleVoiceToggle = () => {
    if (!isVoiceSupported) {
      toast.error('Voice recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setStreamingText('');

    // Add user message
    const newUserMessage: AIMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsProcessing(true);

    try {
      // Get current user from MSAL
      const currentUser = accounts[0]?.name || 'User';

      const context: CommandContext = {
        allROs: ros,
        allShops: shops,
        currentUser,
        queryClient
      };

      // Process command with streaming and conversation history
      const response = await anthropicAgent.processCommand(
        userMessage,
        context,
        (text) => {
          setStreamingText(prev => prev + text);
        },
        messages // Pass conversation history for context
      );

      // Add assistant response
      setMessages(prev => [...prev, response]);
      setStreamingText('');

      // Log successful interaction
      loggingService.logInteraction({
        timestamp: new Date(),
        user: currentUser,
        userMessage: userMessage,
        aiResponse: getMessageText(response.content),
        success: true
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      // Error processing command
      toast.error('Failed to process command', {
        description: errorMessage
      });

      const errorResponse = `I encountered an error: ${errorMessage}. Please try again or rephrase your command.`;

      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorResponse,
        timestamp: new Date()
      }]);

      // Log failed interaction
      loggingService.logInteraction({
        timestamp: new Date(),
        user: accounts[0]?.name || 'User',
        userMessage: userMessage,
        aiResponse: errorResponse,
        success: false,
        error: errorMessage
      });

    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setStreamingText('');
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    toast.success('Conversation history cleared');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-[calc(100%-2rem)] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[85vh] sm:h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-[hsl(var(--bg-primary))]">
        {/* Professional Header */}
        <div className="relative bg-gradient-header px-3 sm:px-4 md:px-6 py-3 sm:py-4 shadow-vibrant-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-xl shadow-md">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl md:text-[24px] font-semibold text-white m-0">
                  AI Assistant
                </DialogTitle>
                <p className="text-[10px] sm:text-xs text-white/70 mt-0.5 hidden sm:block">
                  Powered by Claude Sonnet 4
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-3 text-white/90 text-[13px]">
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-[20px]">
                <Package className="h-3.5 w-3.5" />
                <span>{ros.length} ROs</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-[20px]">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{messages.length} messages</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
          {messages.length === 0 && !streamingText && (
            <div className="min-h-full flex flex-col items-center justify-center px-3 py-8">
              {/* Hero Section */}
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-bright-blue/10 rounded-2xl shadow-vibrant mb-3 sm:mb-4">
                  <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-bright-blue" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                  Welcome to AI Assistant
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-md px-4">
                  Manage your repair orders with natural language commands. I can help with updates, queries, analytics, and more.
                </p>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl mb-4 sm:mb-6">
                <Card className="p-4 sm:p-6 border border-border bg-card-blue shadow-vibrant hover:shadow-vibrant-lg transition-all hover:-translate-y-0.5 duration-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 bg-bright-blue/15 rounded-lg">
                      <Zap className="h-5 w-5 text-bright-blue" />
                    </div>
                    <h3 className="font-semibold text-foreground">Quick Updates</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Update statuses, costs, and dates instantly with natural commands
                  </p>
                </Card>

                <Card className="p-4 sm:p-6 border border-border bg-card-purple shadow-vibrant hover:shadow-vibrant-lg transition-all hover:-translate-y-0.5 duration-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 bg-[#8b5cf6]/15 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-[#8b5cf6]" />
                    </div>
                    <h3 className="font-semibold text-foreground">Smart Queries</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ask questions and get instant insights about your ROs
                  </p>
                </Card>

                <Card className="p-4 sm:p-6 border border-border bg-card-amber shadow-vibrant hover:shadow-vibrant-lg transition-all hover:-translate-y-0.5 duration-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 bg-warning/15 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-warning" />
                    </div>
                    <h3 className="font-semibold text-foreground">Analytics</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get statistics, trends, and performance metrics
                  </p>
                </Card>
              </div>

              {/* Example Commands */}
              <div className="w-full max-w-2xl">
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">
                  Try these example commands:
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => setInput("show me all overdue ROs")}
                    className="w-full text-left p-3.5 bg-secondary border border-border rounded-lg hover:border-bright-blue hover:bg-bright-blue/5 transition-all duration-200 text-sm font-mono group"
                  >
                    <span className="text-muted-foreground group-hover:text-bright-blue">
                      "show me all overdue ROs"
                    </span>
                  </button>
                  <button
                    onClick={() => setInput("update RO39643 as delivered and mark RO40321 as paid")}
                    className="w-full text-left p-3.5 bg-secondary border border-border rounded-lg hover:border-bright-blue hover:bg-bright-blue/5 transition-all duration-200 text-sm font-mono group"
                  >
                    <span className="text-muted-foreground group-hover:text-bright-blue">
                      "update RO39643 as delivered and mark RO40321 as paid"
                    </span>
                  </button>
                  <button
                    onClick={() => setInput("what's the total value of approved repairs?")}
                    className="w-full text-left p-3.5 bg-secondary border border-border rounded-lg hover:border-bright-blue hover:bg-bright-blue/5 transition-all duration-200 text-sm font-mono group"
                  >
                    <span className="text-muted-foreground group-hover:text-bright-blue">
                      "what's the total value of approved repairs?"
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 pt-1">
                  <div className="w-9 h-9 rounded-xl bg-bright-blue/10 border border-bright-blue/20 flex items-center justify-center shadow-sm">
                    <Bot className="h-5 w-5 text-bright-blue" />
                  </div>
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-blue text-white'
                    : 'bg-secondary border border-border text-foreground'
                }`}
              >
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed select-text cursor-text">
                  {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                </div>
                <div className={`text-xs mt-2 flex items-center gap-1 ${
                  message.role === 'user' ? 'text-white/80' : 'text-muted-foreground'
                }`}>
                  <span>{message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 pt-1">
                  <div className="w-9 h-9 rounded-xl bg-deep-blue/10 border border-deep-blue/20 flex items-center justify-center shadow-sm">
                    <User className="h-5 w-5 text-deep-blue" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {streamingText && (
            <div className="flex gap-3 justify-start animate-in fade-in duration-200">
              <div className="flex-shrink-0 pt-1">
                <div className="w-9 h-9 rounded-xl bg-bright-blue/10 border border-bright-blue/20 flex items-center justify-center shadow-sm">
                  <Bot className="h-5 w-5 text-bright-blue animate-pulse" />
                </div>
              </div>
              <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-secondary border border-border shadow-sm">
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground select-text cursor-text">
                  {streamingText}
                  <span className="inline-block w-0.5 h-4 bg-bright-blue ml-1 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area with Professional Design */}
        <div className="border-t border-border bg-background p-3 sm:p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Modern Chat Input with Integrated Buttons */}
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={isListening ? (input + (input && transcript ? ' ' : '') + transcript) : input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isListening
                    ? '🎤 Listening... Speak now'
                    : 'Ask me anything about your repair orders...'
                }
                className="w-full min-h-[80px] sm:min-h-[100px] max-h-[200px] resize-none border-2 border-input focus:border-bright-blue focus:ring-4 focus:ring-bright-blue/10 rounded-xl shadow-sm pr-24 sm:pr-28 pb-12 sm:pb-14 text-sm leading-relaxed transition-all"
                disabled={isProcessing || isListening}
              />

              {/* Character Count */}
              <div className="absolute top-3 right-3 text-xs text-muted-foreground pointer-events-none">
                {input.length > 0 && `${input.length}`}
              </div>

              {/* Action Buttons - Bottom Right Inside Input */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 sm:gap-2">
                {/* Voice Button */}
                {isVoiceSupported && (
                  <Button
                    type="button"
                    onClick={handleVoiceToggle}
                    disabled={isProcessing}
                    size="sm"
                    className={`h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-lg transition-all duration-200 shadow-sm ${
                      isListening
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30 animate-pulse'
                        : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                    }`}
                    title={isListening ? 'Stop recording' : 'Start voice input'}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </Button>
                )}

                {/* Send Button */}
                <Button
                  type="submit"
                  disabled={!input.trim() || isProcessing}
                  size="sm"
                  className="h-9 w-9 sm:h-10 sm:w-10 p-0 bg-gradient-blue hover:bg-bright-blue text-white shadow-[0_2px_8px_rgba(2,132,199,0.3)] hover:shadow-[0_4px_12px_rgba(2,132,199,0.4)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200"
                  title={isProcessing ? 'Processing...' : 'Send message'}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Footer with actions and info */}
          <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  disabled={isProcessing}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Chat
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-foreground bg-secondary border border-border rounded">
                  Ctrl
                </kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-foreground bg-secondary border border-border rounded">
                  K
                </kbd>
              </span>
              <span className="text-muted-foreground">to open</span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
