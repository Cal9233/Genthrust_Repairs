import { useState, useEffect, useRef, useCallback } from 'react';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useVoiceRecognition');

interface VoiceRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

interface UseVoiceRecognitionReturn {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceRecognition(
  options: VoiceRecognitionOptions = {}
): UseVoiceRecognitionReturn {
  const {
    continuous = false,
    interimResults = true,
    lang = 'en-US',
  } = options;

  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Check if browser supports speech recognition
  const isSupported = typeof window !== 'undefined' && (
    'webkitSpeechRecognition' in window ||
    'SpeechRecognition' in window
  );

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    // @ts-ignore - Safari uses webkit prefix
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onstart = () => {
      logger.debug('Voice recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      logger.debug('Voice recognition stopped');
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPiece = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcriptPiece + ' ';
        } else {
          interimTranscript += transcriptPiece;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => (prev + finalTranscript).trim());
        logger.debug('Final transcript captured', {
          transcriptLength: finalTranscript.length,
          wordCount: finalTranscript.split(' ').length
        });
      } else if (interimTranscript && interimResults) {
        setTranscript(interimTranscript.trim());
        logger.debug('Interim transcript captured', {
          transcriptLength: interimTranscript.length
        });
      }
    };

    recognition.onerror = (event: any) => {
      logger.error('Voice recognition error', new Error(event.error), {
        errorType: event.error,
        message: event.message
      });

      let errorMessage = 'Speech recognition error';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your device.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please enable it in settings.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setError(errorMessage);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [continuous, interimResults, lang, isSupported]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported');
      return;
    }

    if (recognitionRef.current && !isListening) {
      try {
        setError(null);
        setTranscript('');
        recognitionRef.current.start();
      } catch (err) {
        logger.error('Failed to start voice recognition', err as Error);
        setError('Failed to start speech recognition');
      }
    }
  }, [isListening, isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    transcript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
