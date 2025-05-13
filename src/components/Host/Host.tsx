import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generateQuizFromTranscript } from '../../services/aiService';
import { subscribeToPusher } from '../../services/pusherService';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';

interface Quiz {
  question: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  timeLimit?: number;
}

const Host: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [quizGenerationInterval, setQuizGenerationInterval] = useState(5); // minutes
  const [quizAnswerTime, setQuizAnswerTime] = useState(60); // seconds
  const [lastQuizTime, setLastQuizTime] = useState<number>(Date.now());
  const [transcriptBuffer, setTranscriptBuffer] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    if (sessionId) {
      const cleanup = subscribeToPusher(sessionId, {
        onUserJoined: (data) => {
          setConnectedUsers(prev => [...prev, data.userId]);
        },
        onAnswerSubmitted: (data) => {
          setQuizAnswers(prev => {
            const newAnswers = new Map(prev);
            newAnswers.set(data.userId, data.answer);
            return newAnswers;
          });
        },
        onQuizEnded: (data) => {
          setCurrentQuiz(null);
          setQuizAnswers(new Map());
        }
      });

      fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      return cleanup;
    }
  }, [sessionId]);

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

        console.log('Generating quiz from transcript:', transcriptBuffer);
        const quiz = await generateQuizFromTranscript(transcriptBuffer);
        
        const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/quiz`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            sessionId, 
            quiz: {
              ...quiz,
              timeLimit: 30 // 30 seconds time limit
            }
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send quiz');
        }

        setCurrentQuiz(quiz);
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

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Host Session</span>
              <Badge variant={isRecording ? "destructive" : "default"}>
                {isRecording ? "Recording" : "Idle"}
              </Badge>
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
                    <p className="whitespace-pre-wrap text-gray-700">{transcript}</p>
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
                        {currentQuiz.options.map((option, index) => (
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
  );
};

export default Host;
