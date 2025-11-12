import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Sparkles, Send, Loader2, User, Bot, Zap, MessageSquare, TrendingUp, Package, X } from 'lucide-react';
import { useROs } from '@/hooks/useROs';
import { useShops } from '@/hooks/useShops';
import { anthropicAgent } from '@/services/anthropicAgent';
import type { CommandContext, AIMessage } from '@/types/aiAgent';
import { toast } from 'sonner';
import { useMsal } from '@azure/msal-react';

interface AIAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAgentDialog({ open, onOpenChange }: AIAgentDialogProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: ros = [] } = useROs();
  const { data: shops = [] } = useShops();
  const { accounts } = useMsal();

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
        currentUser
      };

      // Process command with streaming
      const response = await anthropicAgent.processCommand(
        userMessage,
        context,
        (text) => {
          setStreamingText(prev => prev + text);
        }
      );

      // Add assistant response
      setMessages(prev => [...prev, response]);
      setStreamingText('');

    } catch (error: any) {
      console.error('Error processing command:', error);
      toast.error('Failed to process command', {
        description: error.message
      });

      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I encountered an error: ${error.message}. Please try again or rephrase your command.`,
        timestamp: new Date()
      }]);

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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Modern Header with Gradient */}
        <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 px-6 py-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white m-0">
                  AI Assistant
                </DialogTitle>
                <p className="text-xs text-blue-100 mt-0.5">
                  Powered by Claude Sonnet 4
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-3 text-white/90 text-xs">
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <Package className="h-3.5 w-3.5" />
                <span>{ros.length} ROs</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg">
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

          {/* Decorative gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400"></div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !streamingText && (
            <div className="h-full flex flex-col items-center justify-center">
              {/* Hero Section */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl shadow-lg mb-4">
                  <Sparkles className="h-10 w-10 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome to AI Assistant
                </h2>
                <p className="text-gray-600 max-w-md">
                  Manage your repair orders with natural language commands. I can help with updates, queries, analytics, and more.
                </p>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mb-6">
                <Card className="p-4 border-blue-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                      <Zap className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Quick Updates</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Update statuses, costs, and dates instantly with natural commands
                  </p>
                </Card>

                <Card className="p-4 border-purple-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Smart Queries</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Ask questions and get instant insights about your ROs
                  </p>
                </Card>

                <Card className="p-4 border-indigo-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Analytics</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Get statistics, trends, and performance metrics
                  </p>
                </Card>
              </div>

              {/* Example Commands */}
              <div className="w-full max-w-2xl">
                <p className="text-sm font-medium text-gray-700 mb-3 text-center">
                  Try these example commands:
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => setInput("show me all overdue ROs")}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-sm group"
                  >
                    <span className="text-gray-700 group-hover:text-blue-700">
                      "show me all overdue ROs"
                    </span>
                  </button>
                  <button
                    onClick={() => setInput("update RO39643 as delivered and mark RO40321 as paid")}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all text-sm group"
                  >
                    <span className="text-gray-700 group-hover:text-purple-700">
                      "update RO39643 as delivered and mark RO40321 as paid"
                    </span>
                  </button>
                  <button
                    onClick={() => setInput("what's the total value of approved repairs?")}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all text-sm group"
                  >
                    <span className="text-gray-700 group-hover:text-indigo-700">
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
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 border border-purple-200 flex items-center justify-center shadow-sm">
                    <Bot className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                </div>
                <div className={`text-xs mt-2 flex items-center gap-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  <span>{message.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 pt-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 flex items-center justify-center shadow-sm">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {streamingText && (
            <div className="flex gap-3 justify-start animate-in fade-in duration-200">
              <div className="flex-shrink-0 pt-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 border border-purple-200 flex items-center justify-center shadow-sm">
                  <Bot className="h-5 w-5 text-purple-600 animate-pulse" />
                </div>
              </div>
              <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {streamingText}
                  <span className="inline-block w-0.5 h-4 bg-purple-600 ml-1 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area with Modern Design */}
        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your repair orders..."
                className="flex-1 min-h-[70px] max-h-[140px] resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl shadow-sm pr-12"
                disabled={isProcessing}
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                {input.length > 0 && `${input.length} chars`}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="h-[70px] px-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-xl font-medium"
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Send className="h-5 w-5" />
                    <span className="text-xs">Send</span>
                  </div>
                )}
              </Button>
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
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Chat
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">
                  Ctrl
                </kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">
                  K
                </kbd>
              </span>
              <span className="text-gray-400">to open</span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
