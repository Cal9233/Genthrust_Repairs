import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Loader2, User, Bot } from 'lucide-react';
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
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Assistant
          </DialogTitle>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg">
          {messages.length === 0 && !streamingText && (
            <div className="text-center text-gray-500 py-8">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-300" />
              <p className="text-lg font-medium mb-2">Ready to help!</p>
              <p className="text-sm">
                Try commands like:
              </p>
              <div className="mt-4 space-y-2 text-left max-w-md mx-auto">
                <div className="bg-white p-2 rounded border text-sm">
                  "update RO39643 as delivered and mark RO40321 as paid"
                </div>
                <div className="bg-white p-2 rounded border text-sm">
                  "show me overdue ROs from World Innovations"
                </div>
                <div className="bg-white p-2 rounded border text-sm">
                  "what's the total value of approved repairs?"
                </div>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              )}

              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                </div>
                <div className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {streamingText && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <div className="max-w-[70%] rounded-lg px-4 py-2 bg-white border border-gray-200">
                <div className="whitespace-pre-wrap break-words">
                  {streamingText}
                  <span className="inline-block w-1 h-4 bg-purple-500 ml-1 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your command... (Enter to send, Shift+Enter for new line)"
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            disabled={isProcessing}
          />
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearHistory}
                disabled={isProcessing}
              >
                Clear
              </Button>
            )}
          </div>
        </form>

        <p className="text-xs text-gray-500 text-center">
          Powered by Claude Sonnet 4 • Press Ctrl+K to open
        </p>
      </DialogContent>
    </Dialog>
  );
}
