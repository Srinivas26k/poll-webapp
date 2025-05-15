import Pusher from 'pusher-js';
import { Quiz, UserDetails } from '../types/index';
import { API_URL } from '../config';

// Enable Pusher logging for debugging
Pusher.logToConsole = process.env.NODE_ENV !== 'production'; // Only log in development

interface TranscriptionData {
  text: string;
  isPartial?: boolean;
  timestamp?: number;
}

export interface PusherService {
  onTranscription: (data: { text: string; isPartial?: boolean; timestamp?: number }) => void;
  onQuiz: (quiz: Quiz) => void;
  onParticipantsUpdate: (participants: string[]) => void;
  onAnswer: (data: { userId: string; answer: string; questionId: string }) => void;
  onEndSession: () => void;
}

// Debug environment variables
console.log('Pusher environment variables:', {
  REACT_APP_PUSHER_KEY: process.env.REACT_APP_PUSHER_KEY,
  REACT_APP_PUSHER_CLUSTER: process.env.REACT_APP_PUSHER_CLUSTER
});

if (!process.env.REACT_APP_PUSHER_KEY) {
  console.error('Pusher key is missing! Please check your environment variables.');
}

if (!process.env.REACT_APP_PUSHER_CLUSTER) {
  console.error('Pusher cluster is missing! Please check your environment variables.');
}

const pusher = new Pusher(process.env.REACT_APP_PUSHER_KEY!, {
  cluster: process.env.REACT_APP_PUSHER_CLUSTER!,
  forceTLS: true,
  enabledTransports: ['ws', 'wss']
});

export const subscribeToPusher = (sessionId: string, callbacks: PusherService) => {
  const channel = pusher.subscribe(`session-${sessionId}`);
  if (callbacks.onTranscription) {
    channel.bind('new-transcription', (data: TranscriptionData) => {
      callbacks.onTranscription!(data);
    });
  }
  if (callbacks.onQuiz) {
    channel.bind('new-quiz', (data: { quiz: Quiz }) => {
      callbacks.onQuiz!(data.quiz);
    });
  }

  if (callbacks.onAnswer) {
    channel.bind('answer-submitted', (data: { userId: string; name: string; answer: string; questionId: string }) => {
      callbacks.onAnswer!(data);
    });
  }

  if (callbacks.onParticipantsUpdate) {
    channel.bind('participants-update', (data: { participants: string[] }) => {
      callbacks.onParticipantsUpdate!(data.participants);
    });
  }

  return () => {
    channel.unbind_all();
    pusher.unsubscribe(`session-${sessionId}`);
  };
};
