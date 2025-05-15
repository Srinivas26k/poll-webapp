import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { subscribeToPusher } from '../../services/pusherService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle2, AlertCircle, Users, LogOut } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Quiz, UserDetails } from '../../types';
import { API_URL } from '../../config';

interface TranscriptionData {
  text: string;
  isPartial?: boolean;
  timestamp?: number;
}

// --- API Service Abstraction ---
const fetchSessionDetailsParticipant = async (sessionId: string): Promise<{ host: UserDetails }> => {
  const response = await fetch(`${API_URL}/api/session/${sessionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch session details');
  }
  return response.json();
};

const joinSessionApi = async (sessionId: string, userId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/session/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      participant: {
        email: userId,
        name: userId.split('@')[0], // Use email username as name if not available
        userId: userId
      }
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to join session');
  }
};

const submitQuizAnswerApi = async (sessionId: string, userId: string, answer: string, questionId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/quiz/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      userId,
      answer,
      questionId
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit answer');
  }
};

const leaveSessionApi = async (sessionId: string, userId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/session/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, userId }),
  });
  if (!response.ok) {
    // Log error but proceed with navigation
    console.error('Failed to leave session on server:', response.status, response.statusText);
  }
};


const Participant: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');

  // --- State Definitions ---
  const [transcript, setTranscript] = useState(''); // State for current partial transcript
  const [transcriptions, setTranscriptions] = useState<{ text: string; timestamp: number }[]>([]); // State for finalized transcripts
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // Time remaining for quiz
  const [participants, setParticipants] = useState<string[]>([]); // Participant list from Pusher
  const [sessionHost, setSessionHost] = useState<UserDetails | null>(null);

  // Using ref for userId as it's constant after initial load
  const userIdRef = useRef(localStorage.getItem('userId') || '');

  // --- Effects ---

  // Effect to initialize session, join, and subscribe to Pusher
  useEffect(() => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) {
      navigate('/');
      return;
    }

    if (!sessionId) {
        setError('Session ID is missing.');
        navigate('/');
        return;
    }

    let cleanup: (() => void) | undefined;

    const initializeSession = async () => {
        try {
            // Fetch session details to get host info
            const sessionDetails = await fetchSessionDetailsParticipant(sessionId);
            setSessionHost(sessionDetails.host);

            // Join the session
            await joinSessionApi(sessionId, currentUserId);
            console.log(`Joined session: ${sessionId}`);

            // Subscribe to Pusher events
            cleanup = subscribeToPusher(sessionId, {
                onTranscription: (data: TranscriptionData) => {
                    if (data.isPartial) {
                        setTranscript(data.text);
                    } else {
                        setTranscriptions(prev => [...prev, {
                            text: data.text,
                            timestamp: data.timestamp || Date.now()
                        }]);
                        setTranscript('');
                    }
                    setError(null);
                },
                onQuiz: (quiz) => {
                    setCurrentQuiz(quiz);
                    setHasAnswered(false);
                    setSelectedAnswer(null);
                    setError(null);
                    setTimeRemaining(quiz.timeLimit || 0);
                },
                onParticipantsUpdate: (participantsList) => {
                    setParticipants(participantsList);
                },
                onAnswer: (answerData) => {
                    console.log("Participant received answer:", answerData);
                },
                onEndSession: () => {
                    console.log("Session ended by host.");
                    alert("The session has ended.");
                    navigate('/');
                }
            });
        } catch (err: any) {
            console.error('Failed to initialize session or connect to real-time updates:', err);
            setError(err.message || 'Failed to connect to the session. Please refresh.');
        }
    };

    initializeSession();

    // Cleanup function
    return () => {
        if (cleanup) {
            cleanup();
        }
    };
  }, [sessionId, navigate]);

  // Timer effect for quiz
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (currentQuiz && !hasAnswered && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer!); // Clear interval before returning 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeRemaining === 0 && currentQuiz && !hasAnswered) {
        // Handle time's up without answering
        console.log("Time's up!");
         // Optionally, automatically submit a null or default answer
         // submitAnswer(null); // Or handle time's up state specifically
    }


    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [currentQuiz, hasAnswered, timeRemaining]); // Dependencies

  // Memoized callback for submitting answer
  const submitAnswer = useCallback(async (answer: string) => {
    const currentUserId = userIdRef.current;
    if (!hasAnswered && currentQuiz && sessionId && currentUserId) {
      try {
        await submitQuizAnswerApi(sessionId, currentUserId, answer, currentQuiz.id);

        setSelectedAnswer(answer);
        setHasAnswered(true);
        setError(null); // Clear error on successful submission
        console.log(`Answer submitted: ${answer}`);
      } catch (err: any) {
        console.error('Failed to submit answer:', err);
        setError(err.message || 'Failed to submit answer. Please try again.');
      }
    }
  }, [hasAnswered, currentQuiz, sessionId]); // Dependencies

  // Memoized callback for leaving session
  const leaveSession = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (sessionId && currentUserId) {
      try {
         await leaveSessionApi(sessionId, currentUserId);
      } finally {
         // Always navigate away even if API call fails client-side
         navigate('/');
      }
    } else {
        navigate('/'); // Just navigate if no session ID or user ID
    }
  }, [sessionId, navigate]); // Dependencies

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
            {/* Display host */}
            {sessionHost && (
              <div className="flex items-center space-x-2 p-2 rounded-md bg-blue-50">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">{sessionHost.name}</span>
                <Badge variant="outline" className="ml-auto">Host</Badge>
              </div>
            )}
            {/* Display other participants */}
            {participants
              .filter(p => p !== userIdRef.current && p !== sessionHost?.email) // Filter out current user and host
              .map((participantEmail) => (
              <div
                key={participantEmail}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm">{participantEmail}</span> {/* Display email for now */}
                 {/* You might want to fetch/display participant names here */}
              </div>
            ))}
             {/* Highlight current user */}
             {participants.includes(userIdRef.current) && userIdRef.current !== sessionHost?.email && (
                <div className="flex items-center space-x-2 p-2 rounded-md bg-green-50">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">{userIdRef.current}</span> {/* Display email */}
                    <Badge variant="secondary" className="ml-auto">You</Badge>
                </div>
             )}
          </div>
        </ScrollArea>
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={leaveSession}
          disabled={!sessionId} // Disable if no session ID
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
                <Badge variant="outline" className="font-mono">{userIdRef.current}</Badge>
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
                  <div className="bg-gray-50 p-4 rounded-lg min-h-[200px] max-h-[400px] overflow-y-auto text-sm text-gray-700">
                    <div className="space-y-2">
                      {/* Display finalized transcripts */}
                      {transcriptions.map((item, index) => (
                        <div key={index} className="flex items-start space-x-2">
                           {/* Optional: Display timestamp */}
                           {/* <span className="text-gray-400 text-xs mt-1">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span> */}
                          <p>{item.text}</p>
                        </div>
                      ))}
                      {/* Display current partial transcript */}
                      {transcript && (
                        <div className="flex items-start space-x-2 text-gray-500 italic"> {/* Style partial transcript differently */}
                           {/* Optional: Display current time */}
                           {/* <span className="text-gray-400 text-xs mt-1">
                            {new Date().toLocaleTimeString()}
                          </span> */}
                          <p>{transcript}...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {currentQuiz && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Quiz Question</span>
                      {timeRemaining > 0 && !hasAnswered && ( // Only show timer if time is left and not answered
                        <Badge variant="secondary">
                          Time: {timeRemaining}s
                        </Badge>
                      )}
                       {hasAnswered && selectedAnswer === currentQuiz.correctAnswer && (
                           <Badge variant="outline" className="bg-green-200 text-green-800">Correct!</Badge>
                       )}
                        {hasAnswered && selectedAnswer !== currentQuiz.correctAnswer && (
                           <Badge variant="outline" className="bg-red-200 text-red-800">Incorrect</Badge>
                       )}
                       {timeRemaining === 0 && !hasAnswered && (
                           <Badge variant="outline" className="bg-yellow-200 text-yellow-800">Time's Up</Badge>
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
                              : hasAnswered && option === currentQuiz.correctAnswer
                              ? 'bg-green-100 border-green-300 hover:bg-green-100' // Highlight correct answer after answering
                              : hasAnswered && selectedAnswer === option
                              ? 'bg-red-100 border-red-300 hover:bg-red-100' // Highlight selected incorrect answer
                              : 'hover:bg-accent'
                          }`}
                        >
                          <div className="flex items-center w-full">
                            <span className="mr-2 font-medium">{String.fromCharCode(65 + index)}.</span>
                            <span className="flex-1 text-left">{option}</span> {/* Ensure text is left-aligned */}
                            {hasAnswered && option === currentQuiz.correctAnswer && (
                              <CheckCircle2 className="h-5 w-5 text-green-600 ml-2" />
                            )}
                            {hasAnswered && selectedAnswer === option && option !== currentQuiz.correctAnswer && (
                              <AlertCircle className="h-5 w-5 text-red-600 ml-2" />
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>

                    {hasAnswered && selectedAnswer !== currentQuiz.correctAnswer && currentQuiz.correctAnswer && (
                         <Alert className="mt-4 bg-green-50 border-green-200 text-green-600">
                             <CheckCircle2 className="h-4 w-4 text-green-600" />
                             <AlertDescription>
                                 The correct answer was: {currentQuiz.correctAnswer}
                             </AlertDescription>
                         </Alert>
                     )}

                    {timeRemaining === 0 && !hasAnswered && currentQuiz.correctAnswer && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Time's up! The correct answer was: {currentQuiz.correctAnswer}
                        </AlertDescription>
                      </Alert>
                    )}

                    {currentQuiz.explanation && (hasAnswered || timeRemaining === 0) && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                        <span className="font-medium">Explanation:</span> {currentQuiz.explanation}
                      </div>
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