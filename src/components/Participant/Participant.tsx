import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { subscribeToPusher } from '../../services/pusherService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle2, AlertCircle, Users, LogOut } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Quiz, UserDetails } from '../../types';

interface TranscriptionData {
  text: string;
  isPartial?: boolean;
  timestamp?: number;
}

const Participant: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');
  const [transcript, setTranscript] = useState('');
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [userId] = useState(() => localStorage.getItem('userId') || '');
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [participants, setParticipants] = useState<string[]>([]);
  const [currentUserEmail] = useState(() => localStorage.getItem('userId') || '');
  const [sessionHost, setSessionHost] = useState<UserDetails | null>(null);

  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }

    if (sessionId) {
      // Fetch session details to get host info
      fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/${sessionId}`)
        .then(response => response.json())
        .then(data => {
          setSessionHost(data.host);
        })
        .catch(err => {
          console.error('Failed to fetch session details:', err);
        });

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
          },
          onParticipantsUpdate: (participantsList) => {
            setParticipants(participantsList);
          }
        });

        return cleanup;
      } catch (err) {
        console.error('Failed to connect to real-time updates:', err);
        setError('Failed to connect to real-time updates. Please refresh the page.');
      }
    }
  }, [sessionId, userId, navigate]);

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

  const leaveSession = () => {
    if (sessionId) {
      fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, userId }),
      }).finally(() => {
        navigate('/');
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Participants
          </h2>
          <Badge variant="secondary">{participants.length}</Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {sessionHost && (
              <div className="flex items-center space-x-2 p-2 rounded-md bg-blue-50">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">{sessionHost.name}</span>
                <Badge variant="outline" className="ml-auto">Host</Badge>
              </div>
            )}
            {participants.map((participant) => (
              <div
                key={participant}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm">{participant}</span>
                {participant === currentUserEmail && (
                  <Badge variant="secondary" className="ml-auto">You</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={leaveSession}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Leave Session
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
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
                    <div className="space-y-2">
                      {transcript.split('\n').map((line, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="text-gray-400 text-sm mt-1">
                            {new Date().toLocaleTimeString()}
                          </span>
                          <p className="text-gray-700">{line}</p>
                        </div>
                      ))}
                    </div>
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
                      {currentQuiz.options.map((option: string, index: number) => (
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
    </div>
  );
};

export default Participant;
