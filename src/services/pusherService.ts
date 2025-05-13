import Pusher from 'pusher-js';

// Enable Pusher logging for debugging
Pusher.logToConsole = true;

const pusher = new Pusher(process.env.REACT_APP_PUSHER_KEY!, {
  cluster: process.env.REACT_APP_PUSHER_CLUSTER!,
  forceTLS: true
});

export const subscribeToPusher = (sessionId: string, callbacks: {
  onTranscription?: (text: string) => void;
  onQuiz?: (quiz: any) => void;
  onUserJoined?: (data: { userId: string }) => void;
  onAnswerSubmitted?: (data: { userId: string; answer: string; questionId: string }) => void;
}) => {
  const channel = pusher.subscribe(`session-${sessionId}`);

  if (callbacks.onTranscription) {
    channel.bind('new-transcription', (data: { text: string }) => {
      callbacks.onTranscription!(data.text);
    });
  }

  if (callbacks.onQuiz) {
    channel.bind('new-quiz', (data: { quiz: any }) => {
      callbacks.onQuiz!(data.quiz);
    });
  }

  if (callbacks.onUserJoined) {
    channel.bind('user-joined', (data: { userId: string }) => {
      callbacks.onUserJoined!(data);
    });
  }

  if (callbacks.onAnswerSubmitted) {
    channel.bind('answer-submitted', (data: { userId: string; answer: string; questionId: string }) => {
      callbacks.onAnswerSubmitted!(data);
    });
  }

  return () => {
    channel.unbind_all();
    pusher.unsubscribe(`session-${sessionId}`);
  };
};
