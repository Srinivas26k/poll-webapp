import Pusher from 'pusher-js';
import { Quiz, UserDetails } from '../types/index';

// Enable Pusher logging for debugging
Pusher.logToConsole = true;

interface TranscriptionData {
  text: string;
  isPartial?: boolean;
  timestamp?: number;
}

interface PusherService {
  onTranscription?: (data: TranscriptionData) => void;
  onQuiz?: (quiz: Quiz) => void;
  onUserJoined?: (data: { userId: string; name: string }) => void;
  onAnswerSubmitted?: (data: { userId: string; name: string; answer: string; questionId: string }) => void;
  onQuizEnded?: (data: { quizId: string; answers: Array<{ userId: string; name: string; answer: string }> }) => void;
  onParticipantsUpdate?: (participants: string[]) => void;
}

const pusher = new Pusher(process.env.REACT_APP_PUSHER_KEY!, {
  cluster: process.env.REACT_APP_PUSHER_CLUSTER!,
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

  if (callbacks.onUserJoined) {
    channel.bind('user-joined', (data: { userId: string; name: string }) => {
      callbacks.onUserJoined!(data);
    });
  }

  if (callbacks.onAnswerSubmitted) {
    channel.bind('answer-submitted', (data: { userId: string; name: string; answer: string; questionId: string }) => {
      callbacks.onAnswerSubmitted!(data);
    });
  }

  if (callbacks.onQuizEnded) {
    channel.bind('quiz-ended', (data: { quizId: string; answers: Array<{ userId: string; name: string; answer: string }> }) => {
      callbacks.onQuizEnded!(data);
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
