import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { generateQuizFromTranscript } from '../../services/aiService';
import { subscribeToPusher } from '../../services/pusherService';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, CheckCircle2, Users, LogOut } from 'lucide-react';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Session, Quiz, UserDetails } from '../../types/index';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface SessionResponse {
  sessionId: string;
  session: Session;
}

const Host: React.FC = () => {
  // State definitions
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');
  const [session, setSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [quizGenerationInterval, setQuizGenerationInterval] = useState(5); // minutes
  const [quizAnswerTime, setQuizAnswerTime] = useState(60); // seconds
  const [lastQuizTime, setLastQuizTime] = useState<number>(Date.now());
  const [transcriptBuffer, setTranscriptBuffer] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<UserDetails[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const lastTranscriptRef = useRef('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [quizHistory, setQuizHistory] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [currentUserEmail] = useState(() => localStorage.getItem('userId') || '');

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
      navigate('/');
      return;
    }

    // Fetch session details
    fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/${sessionId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch session');
        }
        return response.json();
      })
      .then((data: Session) => {
        setSession(data);
        // Update connected users with the host
        setConnectedUsers([data.host]);
      })
      .catch(err => {
        console.error('Failed to fetch session:', err);
        setError('Failed to fetch session. Please try again.');
        navigate('/');
      });

    // Subscribe to Pusher events
    const cleanup = subscribeToPusher(sessionId, {
      onTranscription: (data) => {
        setTranscript(prev => {
          if (data.isPartial) {
            return prev + ' ' + data.text;
          }
          return data.text;
        });
        setError(null);
      },
      onParticipantsUpdate: (participantsList) => {
        setParticipants(participantsList);
      }
    });

    return cleanup;
  }, [sessionId, navigate]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const finalTranscript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(' ');
        
        if (finalTranscript !== lastTranscriptRef.current) {
          handleTranscriptUpdate(finalTranscript);
          lastTranscriptRef.current = finalTranscript;
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          // Restart recognition if there's an audio error
          recognition.stop();
          setTimeout(() => {
            if (isRecording) {
              recognition.start();
            }
          }, 1000);
        } else {
          setIsRecording(false);
          setError('Speech recognition error. Please try again.');
        }
      };

      recognition.onend = () => {
        // Restart recognition if it ends unexpectedly while recording
        if (isRecording) {
          recognition.start();
        }
      };

      setRecognition(recognition);
    }
  }, [sessionId]);

  const handleTranscriptUpdate = async (text: string) => {
    try {
      setTranscript(text);
      
      setTranscriptBuffer(prevBuffer => {
        const newBuffer = prevBuffer + ' ' + text;
        return newBuffer.trim();
      });

      if (!sessionId) return;

      const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, text }),
      });

      if (!response.ok) {
        throw new Error('Failed to send transcription');
      }
    } catch (error) {
      console.error('Error sending transcription:', error);
      setError('Failed to send transcription. Please try again.');
    }
  };

  // Timer effect for quiz generation
  useEffect(() => {
    if (!isRecording || !transcriptBuffer.trim()) return;

    const updateTimer = () => {
      const timeLeft = Math.max(0, quizGenerationInterval * 60 * 1000 - (Date.now() - lastQuizTime));
      setTimeRemaining(timeLeft);
    };

    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [isRecording, lastQuizTime, quizGenerationInterval]);

  // Quiz generation effect
  useEffect(() => {
    if (!isRecording || !transcriptBuffer.trim()) return;

    const generateQuiz = async () => {
      try {
        if (Date.now() - lastQuizTime < quizGenerationInterval * 60 * 1000) return;

        console.log('Generating quiz from transcript:', transcriptBuffer);        const quiz = await generateQuizFromTranscript(transcriptBuffer);
        const quizWithId: Quiz = { 
          ...quiz, 
          id: Date.now().toString(),
          timeLimit: quizAnswerTime
        };
        
        const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/quiz`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            sessionId, 
            quiz: quizWithId
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send quiz');
        }
        setCurrentQuiz(quizWithId);
        setLastQuizTime(Date.now());
        setTranscriptBuffer('');
        setError(null);
      } catch (error) {
        console.error('Error generating quiz:', error);
        setError('Failed to generate quiz. Please try again.');
      }
    };

    const timer = setInterval(generateQuiz, 10000);
    return () => clearInterval(timer);
  }, [isRecording, transcriptBuffer, lastQuizTime, quizGenerationInterval, sessionId]);

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
    } else {
      recognition?.start();
    }
    setIsRecording(!isRecording);
  };

  const endSession = () => {
    if (sessionId) {
      fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      }).finally(() => {
        navigate('/');
      });
    }
  };

  // Add this new useEffect for quiz history
  useEffect(() => {
    if (currentQuiz) {
      setQuizHistory(prev => [...prev, currentQuiz]);
    }
  }, [currentQuiz]);

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
            {session?.host && (
              <div className="flex items-center space-x-2 p-2 rounded-md bg-blue-50">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">{session.host.name}</span>
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
          variant="destructive"
          className="mt-4 w-full"
          onClick={endSession}
        >
          <LogOut className="w-4 h-4 mr-2" />
          End Session
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Host Session</span>
                <div className="flex items-center space-x-2">
                  <Badge variant={isRecording ? "destructive" : "default"}>
                    {isRecording ? "Recording" : "Idle"}
                  </Badge>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Quiz History
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Quiz History</DialogTitle>
                      </DialogHeader>
                      <Tabs defaultValue="list">
                        <TabsList>
                          <TabsTrigger value="list">List</TabsTrigger>
                          {selectedQuiz && <TabsTrigger value="details">Details</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="list" className="space-y-4">
                          {quizHistory.map((quiz, index) => (
                            <Card
                              key={quiz.id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => setSelectedQuiz(quiz)}
                            >
                              <CardHeader>
                                <CardTitle className="text-lg">
                                  Quiz {quizHistory.length - index}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-gray-600">{quiz.question}</p>
                                <div className="mt-2 flex items-center space-x-2">
                                  <Badge variant="outline">
                                    {quiz.options.length} options
                                  </Badge>
                                  <Badge variant="outline">
                                    {quiz.timeLimit}s time limit
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </TabsContent>
                        {selectedQuiz && (
                          <TabsContent value="details">
                            <Card>
                              <CardHeader>
                                <CardTitle>Quiz Details</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-4">
                                  <div>
                                    <h3 className="font-medium mb-2">Question</h3>
                                    <p className="text-gray-600">{selectedQuiz.question}</p>
                                  </div>
                                  <div>
                                    <h3 className="font-medium mb-2">Options</h3>
                                    <div className="space-y-2">
                                      {selectedQuiz.options.map((option, index) => (
                                        <div
                                          key={index}
                                          className={`p-2 rounded ${
                                            option === selectedQuiz.correctAnswer
                                              ? 'bg-green-50 border border-green-200'
                                              : 'bg-gray-50'
                                          }`}
                                        >
                                          {option}
                                          {option === selectedQuiz.correctAnswer && (
                                            <Badge className="ml-2" variant="secondary">
                                              Correct
                                            </Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="font-medium mb-2">Answers</h3>
                                    <div className="space-y-2">
                                      {Array.from(quizAnswers.entries()).map(([userId, answer]) => (
                                        <div key={userId} className="flex items-center space-x-2">
                                          <Badge variant="outline">{userId}</Badge>
                                          <span>{answer}</span>
                                          {answer === selectedQuiz.correctAnswer && (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </TabsContent>
                        )}
                      </Tabs>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Session ID:</span>
                  <Badge variant="outline" className="font-mono">{sessionId}</Badge>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Connected Users:</span>
                  <Badge variant="secondary">{connectedUsers.length}</Badge>
                </div>

                <div className="flex items-center space-x-4">
                  <Button
                    onClick={toggleRecording}
                    variant={isRecording ? "destructive" : "default"}
                    size="lg"
                  >
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quiz Generation Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Generate quiz every {quizGenerationInterval} minutes</Label>
                          <Slider
                            value={[quizGenerationInterval]}
                            onValueChange={(value: number[]) => setQuizGenerationInterval(value[0])}
                            min={1}
                            max={15}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quiz Answer Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Answer time: {quizAnswerTime} seconds</Label>
                          <Slider
                            value={[quizAnswerTime]}
                            onValueChange={(value: number[]) => setQuizAnswerTime(value[0])}
                            min={15}
                            max={300}
                            step={15}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Time until next quiz:</span>
                    <span>{Math.ceil(timeRemaining / 1000)}s</span>
                  </div>
                  <Progress 
                    value={(timeRemaining / (quizGenerationInterval * 60 * 1000)) * 100} 
                    className="h-2"
                  />
                </div>

                <Card className="bg-white">
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
                      <CardTitle>Current Quiz</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <p className="text-lg font-medium">{currentQuiz.question}</p>
                        
                        <div className="space-y-2">
                          {currentQuiz.options.map((option: string, index: number) => (
                            <div
                              key={index}
                              className={`p-3 rounded-lg border ${
                                option === currentQuiz.correctAnswer
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-white'
                              }`}
                            >
                              {option}
                            </div>
                          ))}
                        </div>

                        {currentQuiz.explanation && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Explanation:</span> {currentQuiz.explanation}
                            </p>
                          </div>
                        )}

                        <div className="mt-4">
                          <h4 className="text-sm font-medium mb-2">Answers Received:</h4>
                          <div className="space-y-2">
                            {Array.from(quizAnswers.entries()).map(([userId, answer]) => (
                              <div key={userId} className="flex items-center space-x-2">
                                <Badge variant="outline">{userId}</Badge>
                                <span>{answer}</span>
                                {answer === currentQuiz.correctAnswer && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Host;
