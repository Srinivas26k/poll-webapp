import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subscribeToPusher } from '../../services/pusherService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Quiz {
  id: number;
  question: string;
  options: string[];
  timeLimit?: number;
}

interface TranscriptionData {
  text: string;
  isPartial?: boolean;
  timestamp?: number;
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
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('userId', userId);

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

      try {
        const cleanup = subscribeToPusher(sessionId, {
          onTranscription: (data: TranscriptionData) => {
            setTranscript(prev => {
              if (data.isPartial) {
                return prev + ' ' + data.text;
              }
              return data.text;
            });
            setError(null);
          },
          onQuiz: (quiz) => {
            setCurrentQuiz(quiz);
            setHasAnswered(false);
            setSelectedAnswer(null);
            setError(null);
            if (quiz.timeLimit) {
              setTimeRemaining(quiz.timeLimit);
            }
          }
        });

        return cleanup;
      } catch (err) {
        console.error('Failed to connect to real-time updates:', err);
        setError('Failed to connect to real-time updates. Please refresh the page.');
      }
    }
  }, [sessionId, userId]);

  // Timer effect for quiz
  useEffect(() => {
    if (!currentQuiz || hasAnswered || !timeRemaining) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuiz, hasAnswered, timeRemaining]);

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

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Session: {sessionId}</span>
              <Badge variant="outline" className="font-mono">{userId}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Live Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg min-h-[200px] max-h-[400px] overflow-y-auto">
                  <p className="whitespace-pre-wrap text-gray-700">{transcript}</p>
                </div>
              </CardContent>
            </Card>

            {currentQuiz && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Quiz Question</span>
                    {timeRemaining > 0 && (
                      <Badge variant="secondary">
                        Time: {timeRemaining}s
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-6 text-lg font-medium">{currentQuiz.question}</p>
                  
                  <div className="space-y-3">
                    {currentQuiz.options.map((option, index) => (
                      <Button
                        key={index}
                        onClick={() => submitAnswer(option)}
                        disabled={hasAnswered || timeRemaining === 0}
                        variant={selectedAnswer === option ? "default" : "outline"}
                        className={`w-full justify-start ${
                          selectedAnswer === option
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent'
                        }`}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  
                  {hasAnswered && (
                    <Alert className="mt-4 bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-600">
                        Your answer has been submitted!
                      </AlertDescription>
                    </Alert>
                  )}

                  {timeRemaining === 0 && !hasAnswered && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Time's up! You can no longer submit an answer.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Participant;
