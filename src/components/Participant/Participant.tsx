import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subscribeToPusher } from '../../services/pusherService';

interface Quiz {
  id: number;
  question: string;
  options: string[];
}

const Participant: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [transcript, setTranscript] = useState('');
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [userId] = useState(() => localStorage.getItem('userId') || Math.random().toString(36).substring(2, 8));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (sessionId) {
      // Save userId to localStorage
      localStorage.setItem('userId', userId);

      // Join the session
      fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, userId }),
      }).catch(err => {
        console.error('Failed to join session:', err);
        setError('Failed to join session. Please try again.');
      });

      // Subscribe to Pusher events
      try {
        const cleanup = subscribeToPusher(sessionId, {
          onTranscription: (text) => {
            setTranscript(text);
            setError(null); // Clear error when we receive data
          },
          onQuiz: (quiz) => {
            setCurrentQuiz(quiz);
            setHasAnswered(false);
            setSelectedAnswer(null);
            setError(null); // Clear error when we receive data
          }
        });

        return cleanup;
      } catch (err) {
        console.error('Failed to connect to real-time updates:', err);
        setError('Failed to connect to real-time updates. Please refresh the page.');
      }
    }
  }, [sessionId, userId]);
  const submitAnswer = async (answer: string) => {
    if (!hasAnswered && currentQuiz && sessionId) {
      try {
        const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/quiz/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            userId,
            answer,
            questionId: currentQuiz.id
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to submit answer');
        }

        setSelectedAnswer(answer);
        setHasAnswered(true);
        setError(null);
      } catch (err) {
        console.error('Failed to submit answer:', err);
        setError('Failed to submit answer. Please try again.');
      }
    }
  };

  return (    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Session: {sessionId}</h1>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold mb-2">Live Transcript:</h2>
            <p className="whitespace-pre-wrap">{transcript}</p>
          </div>

          {currentQuiz && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-4">Quiz Question:</h2>
              <p className="mb-4">{currentQuiz.question}</p>
              
              <div className="space-y-2">
                {currentQuiz.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => submitAnswer(option)}
                    disabled={hasAnswered}
                    className={`w-full p-3 text-left rounded ${
                      selectedAnswer === option
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border hover:bg-gray-50'
                    } ${hasAnswered ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              
              {hasAnswered && (
                <p className="mt-4 text-green-600">Your answer has been submitted!</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Participant;
