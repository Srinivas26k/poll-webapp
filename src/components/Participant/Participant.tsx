import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

interface Quiz {
  id: number;
  question: string;
  options: string[];
}

const Participant: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [transcript, setTranscript] = useState('');
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000');
    setSocket(newSocket);

    if (sessionId) {
      newSocket.emit('join-session', sessionId);
    }

    newSocket.on('transcription-update', (text: string) => {
      setTranscript(text);
    });

    newSocket.on('new-quiz', (quiz: Quiz) => {
      setCurrentQuiz(quiz);
      setHasAnswered(false);
      setSelectedAnswer(null);
    });

    return () => {
      newSocket.close();
    };
  }, [sessionId]);

  const submitAnswer = (answer: string) => {
    if (!hasAnswered && currentQuiz) {
      socket?.emit('submit-answer', {
        sessionId,
        answer,
        questionId: currentQuiz.id
      });
      setSelectedAnswer(answer);
      setHasAnswered(true);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Session: {sessionId}</h1>

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
