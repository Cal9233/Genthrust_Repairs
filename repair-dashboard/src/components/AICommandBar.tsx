import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, AlertCircle, CheckCircle2, Loader2, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { aiParserService } from '../services/aiParser';
import { commandProcessorService } from '../services/commandProcessor';
import type { ParsedCommand, CommandValidation } from '../types/aiCommand';
import { useQueryClient } from '@tanstack/react-query';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useLogger } from '../utils/logger';

interface AICommandBarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AICommandBar({ isOpen, onClose }: AICommandBarProps) {
  const logger = useLogger('AICommandBar', { isOpen });

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [validation, setValidation] = useState<CommandValidation | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Update input when transcript changes
  useEffect(() => {
    if (transcript && !isListening) {
      // Only update when recording stops (final transcript)
      setInput(transcript);
      resetTranscript();
    }
  }, [transcript, isListening, resetTranscript]);

  // Show toast if voice error occurs
  useEffect(() => {
    if (voiceError) {
      toast.error(voiceError);
    }
  }, [voiceError]);

  // Check if AI is configured
  const configStatus = aiParserService.getConfigStatus();

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

    if (!input.trim()) return;

    if (!configStatus.configured) {
      toast.error(configStatus.message);
      return;
    }

    setIsProcessing(true);

    try {
      // Parse the command using AI
      const aiResponse = await aiParserService.parseCommand(input);

      // Create parsed command
      const command = commandProcessorService.createParsedCommand(input, aiResponse);

      // Validate the command
      const validation = await commandProcessorService.validateCommand(command);

      setParsedCommand(command);
      setValidation(validation);

      // Show confirmation dialog if validation passed
      if (validation.isValid) {
        setShowConfirmation(true);
      } else {
        toast.error(`Invalid command: ${validation.errors.join(', ')}`);
      }
    } catch (error: any) {
      logger.error('Command parsing error', error, {
        inputLength: input.length
      });
      toast.error(error.message || 'Failed to parse command');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!parsedCommand) return;

    setIsProcessing(true);
    setShowConfirmation(false);

    try {
      const result = await commandProcessorService.executeCommand(parsedCommand);

      if (result.success) {
        toast.success(result.message);

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['ros'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

        // Clear and close
        setInput('');
        setParsedCommand(null);
        setValidation(null);
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      logger.error('Command execution error', error, {
        action: parsedCommand?.action,
        roNumber: parsedCommand?.roNumber
      });
      toast.error(error.message || 'Failed to execute command');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setParsedCommand(null);
    setValidation(null);
  };

  const handleClose = () => {
    setInput('');
    setParsedCommand(null);
    setValidation(null);
    setShowConfirmation(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showConfirmation} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Command Assistant
            </DialogTitle>
            <DialogDescription>
              Type a command in natural language to update repair orders.
            </DialogDescription>
          </DialogHeader>

          {!configStatus.configured && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">AI not configured</p>
                <p className="mt-1">{configStatus.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    isListening
                      ? '🎤 Listening...'
                      : 'e.g., "RO G38462 Scheduled Completion Date: 11/18/25"'
                  }
                  value={isListening ? transcript : input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isProcessing || !configStatus.configured || isListening}
                  className="text-base h-12 border-input focus:border-purple-500 focus:ring-purple-500 pr-12"
                />
                <Button
                  type="button"
                  onClick={handleVoiceToggle}
                  disabled={isProcessing || !configStatus.configured}
                  variant="ghost"
                  size="icon"
                  className={`absolute right-1 top-1 h-10 w-10 ${
                    isListening
                      ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title={isListening ? 'Stop recording' : 'Start voice input'}
                >
                  {isListening ? (
                    <MicOff className="h-5 w-5 animate-pulse" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Examples:</p>
                  {isVoiceSupported && (
                    <span className="text-purple-600 font-medium flex items-center gap-1">
                      <Mic className="h-3 w-3" />
                      Voice input available
                    </span>
                  )}
                </div>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>RO G38462 scheduled for 11/18/25</li>
                  <li>Update RO 12345 status to being repaired</li>
                  <li>Set reminder for RO G38462 on 11/20/25</li>
                  <li>RO 98765 cost is $2,500</li>
                  <li>Add note to RO 54321: Customer called for update</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!input.trim() || isProcessing || !configStatus.configured}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Parse Command
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={() => setShowConfirmation(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Confirm Command
            </DialogTitle>
            <DialogDescription>
              Please review and confirm the action to be performed.
            </DialogDescription>
          </DialogHeader>

          {parsedCommand && (
            <div className="space-y-4">
              {/* Original Command */}
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Original Command</p>
                <p className="text-sm text-foreground">{parsedCommand.originalText}</p>
              </div>

              {/* Parsed Action */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Will perform:</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900">
                    {commandProcessorService.getCommandSummary(parsedCommand)}
                  </p>
                </div>
              </div>

              {/* Confidence Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Confidence:</span>
                <Badge
                  variant={
                    parsedCommand.confidence >= 0.8
                      ? 'default'
                      : parsedCommand.confidence >= 0.6
                      ? 'secondary'
                      : 'destructive'
                  }
                  className={
                    parsedCommand.confidence >= 0.8
                      ? 'bg-green-600'
                      : parsedCommand.confidence >= 0.6
                      ? 'bg-yellow-600'
                      : ''
                  }
                >
                  {Math.round(parsedCommand.confidence * 100)}%
                </Badge>
              </div>

              {/* Warnings */}
              {validation?.warnings && validation.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-800 mb-1">Warnings:</p>
                  <ul className="text-xs text-yellow-700 space-y-0.5">
                    {validation.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Execute Command
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
