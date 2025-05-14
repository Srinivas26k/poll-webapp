import Pusher from 'pusher-js';
import { Quiz, UserDetails } from '../types/index';

// Enable Pusher logging for debugging
Pusher.logToConsole = true;

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

const pusher = new Pusher(process.env.REACT_APP_PUSHER_KEY!, {
  cluster: process.env.PUSHER_CLUSTER!,
  forceTLS: true
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
