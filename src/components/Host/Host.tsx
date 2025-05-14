import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface SessionResponse {
  sessionId: string;
  session: Session;
}

// --- API Service Abstraction ---
// It's beneficial to abstract API calls into separate functions or a dedicated service.
const fetchSessionDetails = async (sessionId: string): Promise<Session> => {
  const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/${sessionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch session');
  }
  return response.json();
};

const postTranscription = async (sessionId: string, text: string, timestamp: number): Promise<void> => {
  const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/transcription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      text,
      timestamp
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to send transcription');
  }
};

const postQuiz = async (sessionId: string, quiz: Quiz): Promise<void> => {
  const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      quiz
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to send quiz');
  }
};

const endSessionApi = async (sessionId: string): Promise<void> => {
  const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) {
    // Even if the response is not ok, we might still want to navigate away.
    // Log the error but don't necessarily block navigation.
    console.error('Failed to end session on server:', response.status, response.statusText);
  }
};


const Host: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');

  // --- State Definitions ---
  const [session, setSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [quizGenerationInterval, setQuizGenerationInterval] = useState(5); // minutes
  const [quizAnswerTime, setQuizAnswerTime] = useState(60); // seconds
  const [lastQuizTime, setLastQuizTime] = useState<number>(Date.now());
  const [connectedUsers, setConnectedUsers] = useState<UserDetails[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // Time until next quiz in seconds
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Map<string, string>>(new Map()); // Map of userId to answer
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]); // Simplified participant list from Pusher
  const [quizHistory, setQuizHistory] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  // Using refs for mutable values that don't trigger re-renders
  const transcriptBuffer = useRef<string[]>([]);
  const lastTranscriptionTime = useRef<number>(Date.now());
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null); // Ref for SpeechRecognition instance

  const currentUserEmail = localStorage.getItem('userId') || ''; // Get user ID once

  // --- Effects ---

  // Effect to initialize session and subscribe to Pusher
  useEffect(() => {
    if (!sessionId || !currentUserEmail) {
      navigate('/');
      return;
    }

    const fetchSession = async () => {
      try {
        const data = await fetchSessionDetails(sessionId);
        setSession(data);
        // Add host to connected users initially
        setConnectedUsers([data.host]);
      } catch (err: any) {
        console.error('Failed to fetch session:', err);
        setError(err.message);
        navigate('/'); // Redirect on failure
      }
    };

    fetchSession();

    // Subscribe to Pusher events
    const cleanupPusher = subscribeToPusher(sessionId, {
      onTranscription: (data) => {
        // Handle partial and final transcripts. A more robust approach for
        // combining partials could be implemented if needed.
        if (data.isPartial) {
          // Append partial transcript to a temporary display state if desired
          // setTranscript(prev => prev + data.text); // Example: if you have a display transcript state
        } else {
          // Add final transcript to buffer
          transcriptBuffer.current.push(data.text);
          // Trigger sending buffered transcript if enough time has passed or buffer is large
          const now = Date.now();
          if (now - lastTranscriptionTime.current >= 5000 || transcriptBuffer.current.length >= 5) { // Send every 5s or after 5 entries
             sendBufferedTranscription(); // Call the memoized callback
             lastTranscriptionTime.current = now;
          }
        }
        setError(null); // Clear error on successful transcription
      },
      onQuiz: (quiz) => {
         // Handle incoming quizzes if needed by the host (e.g., for display or validation)
         console.log("Received quiz on host side:", quiz);
         // Note: The host is generating and sending quizzes, so receiving them back might be for sync/validation.
         // If the host doesn't need to process incoming quizzes, this can be removed.
      },
      onParticipantsUpdate: (participantsList) => {
        // Update participant list based on Pusher data
        setParticipants(participantsList);
        // You might want to fetch user details for these participants if needed
        // based on their IDs/emails in participantsList.
      },
       onAnswer: (answerData) => {
        // Update quiz answers when participants submit them
        setQuizAnswers(prev => new Map(prev).set(answerData.userId, answerData.answer));
       },
       onEndSession: () => {
        // Handle session end initiated by another host (if multiple hosts are possible)
        console.log("Session ended by another host.");
        navigate('/');
       }
    });

    // Setup interval to send buffered transcript periodically
    transcriptionIntervalRef.current = setInterval(() => {
      sendBufferedTranscription();
    }, 10000); // Send every 10 seconds

    // Cleanup function for effects
    return () => {
      cleanupPusher(); // Clean up Pusher subscription
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current); // Clear transcription interval
      }
      // Stopping recognition is handled in the toggleRecording and cleanup effect below
    };
  }, [sessionId, navigate, currentUserEmail]); // Dependencies: sessionId, navigate, currentUserEmail

  // Effect to initialize and manage Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      const finalTranscript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join(' ');

      // Process and buffer the new portion of the transcript
      const newText = finalTranscript; // Assuming recognition provides cumulative transcript
       if (newText) {
           // Implement logic to extract only the *new* part of the transcript
           // This requires keeping track of the previously processed transcript.
           // For simplicity, let's assume we process the full transcript for now
           // and handle potential duplicates server-side or by more advanced buffering.
           handleTranscriptUpdate(newText); // Use the memoized callback
       }
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError(`Speech recognition error: ${event.error}. Please try again.`);
      setIsRecording(false); // Stop recording state on error
    };

    recognitionInstance.onend = () => {
      console.log('Speech recognition ended.');
      // If recording is still intended, attempt to restart
      if (isRecording && speechRecognitionRef.current) {
           // Add a small delay before attempting to restart
           setTimeout(() => {
               if (isRecording && speechRecognitionRef.current) {
                   speechRecognitionRef.current.start();
               }
           }, 1000);
       } else {
           setIsRecording(false); // Ensure state is correct if recording wasn't intended
       }
    };

    speechRecognitionRef.current = recognitionInstance; // Store instance in ref
    setRecognition(recognitionInstance); // Also store in state if needed for UI toggling

    // Cleanup function to stop recognition when component unmounts
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
      }
    };
  }, []); // Empty dependency array: runs once on mount

  // Memoized callback for sending buffered transcription
  const sendBufferedTranscription = useCallback(async () => {
    if (transcriptBuffer.current.length === 0 || !sessionId) return;

    const textToSend = transcriptBuffer.current.join(' ');
    transcriptBuffer.current = []; // Clear the buffer

    try {
      await postTranscription(sessionId, textToSend, Date.now());
      console.log('Buffered transcription sent.');
    } catch (error: any) {
      console.error('Error sending buffered transcription:', error);
      setError('Failed to send transcription. Please check your connection.');
    }
  }, [sessionId]); // Dependency: sessionId

  // Memoized callback to handle incoming transcript updates from speech recognition
   const handleTranscriptUpdate = useCallback((text: string) => {
       // Update UI transcript state if needed (separate from buffer)
       // setTranscript(text); // Example: if you have a display transcript state

       // Buffer the text. More advanced buffering logic can go here
       transcriptBuffer.current.push(text);
       const now = Date.now();
       if (now - lastTranscriptionTime.current >= 5000 || transcriptBuffer.current.length >= 5) { // Send every 5s or after 5 entries
           sendBufferedTranscription(); // Call the memoized callback
           lastTranscriptionTime.current = now;
       }
   }, [sendBufferedTranscription]); // Dependency: sendBufferedTranscription

  // Timer effect for quiz generation countdown
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRecording) {
      const updateTimer = () => {
        const timePassed = Date.now() - lastQuizTime;
        const timeLeft = Math.max(0, quizGenerationInterval * 60 * 1000 - timePassed);
        setTimeRemaining(Math.ceil(timeLeft / 1000)); // Update time remaining in seconds
      };

      updateTimer(); // Initial call
      timer = setInterval(updateTimer, 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isRecording, lastQuizTime, quizGenerationInterval]); // Dependencies: isRecording, lastQuizTime, quizGenerationInterval

  // Quiz generation effect
  useEffect(() => {
    let quizTimer: NodeJS.Timeout | null = null;
    if (isRecording && sessionId) {
      const generateQuiz = async () => {
        const timePassed = Date.now() - lastQuizTime;
        if (timePassed >= quizGenerationInterval * 60 * 1000) {
          console.log('Attempting to generate quiz...');
          // Use the buffered transcript for quiz generation
          const transcriptToUse = transcriptBuffer.current.join(' ');
          if (!transcriptToUse.trim()) {
             console.log("Transcript buffer is empty, skipping quiz generation.");
             setLastQuizTime(Date.now()); // Reset timer even if no quiz is generated
             return;
          }
           // Clear the buffer after using it for quiz generation
          transcriptBuffer.current = [];

          try {
            console.log('Generating quiz from transcript:', transcriptToUse);
            const quiz = await generateQuizFromTranscript(transcriptToUse);
            const quizWithId: Quiz = {
              ...quiz,
              id: Date.now().toString(), // Simple ID generation
              timeLimit: quizAnswerTime,
              timestamp: Date.now(), // Add timestamp for history sorting if needed
            };

            await postQuiz(sessionId, quizWithId);
            setCurrentQuiz(quizWithId);
            setQuizHistory(prev => [...prev, quizWithId]); // Add to history
            setQuizAnswers(new Map()); // Reset answers for the new quiz
            setLastQuizTime(Date.now()); // Reset quiz timer
            setError(null); // Clear error on success
            console.log('Quiz generated and sent:', quizWithId);

          } catch (error: any) {
            console.error('Error generating or sending quiz:', error);
            setError('Failed to generate or send quiz. Please try again.');
            // Optionally, reset timer here as well if an error shouldn't block future attempts
            setLastQuizTime(Date.now());
          }
        }
      };

      quizTimer = setInterval(generateQuiz, 10000); // Check every 10 seconds

    } else {
        // Clear time remaining if not recording
        setTimeRemaining(0);
    }

    return () => {
      if (quizTimer) {
        clearInterval(quizTimer);
      }
    };
  }, [isRecording, lastQuizTime, quizGenerationInterval, sessionId, quizAnswerTime]); // Dependencies

  // --- Event Handlers ---

  const toggleRecording = () => {
    if (!recognition) {
      setError('Speech recognition is not available.');
      return;
    }
    if (isRecording) {
      recognition.stop();
    } else {
      // Clear transcript buffer and reset timer on start
      transcriptBuffer.current = [];
      lastTranscriptionTime.current = Date.now();
      setLastQuizTime(Date.now());
      setTimeRemaining(quizGenerationInterval * 60); // Set initial time remaining
      recognition.start();
    }
    setIsRecording(!isRecording);
  };

  const endSession = async () => {
    if (sessionId) {
      try {
        await endSessionApi(sessionId);
      } finally {
        // Always navigate away even if API call failed client-side
        navigate('/');
      }
    } else {
       navigate('/'); // Just navigate if no session ID
    }
  };

  const handleQuizSelect = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    // Optionally fetch answers for the selected quiz from the server if not already available
    // fetchAnswersForQuiz(quiz.id).then(setQuizAnswers);
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
            {/* Display host separately */}
            {session?.host && (
              <div className="flex items-center space-x-2 p-2 rounded-md bg-blue-50">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">{session.host.name}</span>
                <Badge variant="outline" className="ml-auto">Host</Badge>
              </div>
            )}
            {/* Display other participants */}
            {participants
               .filter(p => p !== currentUserEmail && p !== session?.host.email) // Filter out current user and host
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
             {/* Highlight current user if they are also a participant (unlikely for host, but good practice) */}
             {participants.includes(currentUserEmail) && currentUserEmail !== session?.host.email && (
                <div className="flex items-center space-x-2 p-2 rounded-md bg-green-50">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">{currentUserEmail}</span> {/* Display email */}
                    <Badge variant="secondary" className="ml-auto">You</Badge>
                </div>
             )}
          </div>
        </ScrollArea>
        <Button
          variant="destructive"
          className="mt-4 w-full"
          onClick={endSession}
          disabled={!sessionId} // Disable if no session ID
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
                        Quiz History ({quizHistory.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Quiz History</DialogTitle>
                        <DialogDescription>
                          View and analyze past quizzes and their results. Select a quiz to see details.
                        </DialogDescription>
                      </DialogHeader>
                      <Tabs defaultValue="list">
                        <TabsList>
                          <TabsTrigger value="list">List</TabsTrigger>
                          {selectedQuiz && <TabsTrigger value="details">Details</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="list" className="space-y-4">
                           {quizHistory.length === 0 ? (
                                <p className="text-center text-gray-500">No quizzes generated yet.</p>
                            ) : (
                                // Sort quizzes by timestamp if available, otherwise by index
                                quizHistory
                                   .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                                   .map((quiz, index) => (
                                     <Card
                                       key={quiz.id}
                                       className="cursor-pointer hover:bg-gray-50"
                                       onClick={() => handleQuizSelect(quiz)}
                                     >
                                       <CardHeader>
                                         <CardTitle className="text-lg">
                                           Quiz {quizHistory.length - index}
                                         </CardTitle>
                                       </CardHeader>
                                       <CardContent>
                                         <p className="text-gray-600 line-clamp-2">{quiz.question}</p>
                                         <div className="mt-2 flex items-center space-x-2">
                                           <Badge variant="outline">
                                             {quiz.options.length} options
                                           </Badge>
                                         </div>
                                       </CardContent>
                                     </Card>
                                   ))
                             )}
                        </TabsContent>
                        {selectedQuiz && (
                          <TabsContent value="details">
                            <Card>
                              <CardHeader>
                                <CardTitle>Quiz Details</CardTitle>
                                {/* Button to go back to list */}
                                <Button variant="outline" size="sm" onClick={() => setSelectedQuiz(null)}>
                                    Back to List
                                </Button>
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
                                          {String.fromCharCode(65 + index)}. {option}
                                          {option === selectedQuiz.correctAnswer && (
                                            <Badge className="ml-2" variant="secondary">
                                              Correct
                                            </Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {/* Display answers for the selected quiz */}
                                  <div>
                                    <h3 className="font-medium mb-2">Answers Received</h3>
                                    {Array.from(quizAnswers.entries()).length === 0 ? (
                                        <p className="text-gray-500">No answers received yet for this quiz.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {Array.from(quizAnswers.entries()).map(([userId, answer]) => (
                                            <div key={userId} className="flex items-center space-x-2">
                                                <Badge variant="outline">{userId}</Badge>
                                                <span>{answer}</span>
                                                {answer === selectedQuiz.correctAnswer ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                ) : (
                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            </div>
                                            ))}
                                        </div>
                                    )}
                                  </div>
                                     {/* Display explanation for the selected quiz */}
                                    {selectedQuiz.explanation && (
                                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600">
                                                <span className="font-medium">Explanation:</span> {selectedQuiz.explanation}
                                            </p>
                                        </div>
                                    )}
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
                  <Badge variant="secondary">{participants.length}</Badge> {/* Use participants state */}
                </div>

                <div className="flex items-center space-x-4">
                  <Button
                    onClick={toggleRecording}
                    variant={isRecording ? "destructive" : "default"}
                    size="lg"
                    disabled={!recognition} // Disable if speech recognition not available
                  >
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Use responsive grid */}
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
                            disabled={isRecording} // Disable settings while recording
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
                            disabled={isRecording} // Disable settings while recording
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                 {/* Time until next quiz display */}
                 {isRecording && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Time until next quiz:</span>
                        <span>{timeRemaining}s</span>
                      </div>
                      <Progress
                        value={(timeRemaining / (quizGenerationInterval * 60)) * 100} // Calculate progress based on seconds
                        className="h-2"
                      />
                    </div>
                 )}


                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg">Live Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                     {/* Display transcript (consider a separate state for display transcript) */}
                    <div className="bg-gray-50 p-4 rounded-lg min-h-[100px] max-h-[300px] overflow-y-auto text-sm text-gray-700">
                        <p>{/* Display a state variable holding the current transcript */}</p>
                        {/* Note: The original code displayed `transcript`, which was updated with partials.
                            A better approach is to have a separate state for the currently spoken text
                            and update a 'finalized transcripts' list when a complete sentence is detected. */}
                         <p>Transcript buffering active...</p> {/* Placeholder */}
                    </div>
                  </CardContent>
                </Card>

                {currentQuiz && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Current Quiz</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {Array.from(quizAnswers.entries()).length} answers
                          </Badge>
                           {/* Display quiz time remaining if available (handled by participant) */}
                           {/* The host doesn't necessarily need to display this, but could if syncing */}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <p className="text-lg font-medium">{currentQuiz.question}</p>

                        <div className="space-y-2">
                          {currentQuiz.options.map((option: string, index: number) => {
                            const answerCount = Array.from(quizAnswers.values()).filter(a => a === option).length;
                            const totalAnswers = Array.from(quizAnswers.entries()).length;
                            const percentage = totalAnswers > 0 ? (answerCount / totalAnswers) * 100 : 0;

                            return (
                              <div
                                key={index}
                                className={`p-3 rounded-lg border ${
                                  option === currentQuiz.correctAnswer
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center">
                                    <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                                    <span>{option}</span>
                                    {option === currentQuiz.correctAnswer && (
                                      <CheckCircle2 className="h-4 w-4 text-green-500 ml-2" />
                                    )}
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    {answerCount} vote{answerCount !== 1 ? 's' : ''} ({percentage.toFixed(1)}%)
                                  </span>
                                </div>
                                <Progress
                                  value={percentage}
                                  className={`h-2 ${
                                    option === currentQuiz.correctAnswer ? 'bg-green-400' : 'bg-blue-200' // Use blue for other options
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {currentQuiz.explanation && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                            <span className="font-medium">Explanation:</span> {currentQuiz.explanation}
                          </div>
                        )}

                        <div className="mt-4">
                          <h4 className="text-sm font-medium mb-2">Answers Received:</h4>
                          {Array.from(quizAnswers.entries()).length === 0 ? (
                              <p className="text-gray-500 text-sm">No answers received yet.</p>
                          ) : (
                            <div className="space-y-2 text-sm">
                              {Array.from(quizAnswers.entries()).map(([userId, answer]) => (
                                <div key={userId} className="flex items-center space-x-2">
                                  <Badge variant="outline">{userId}</Badge>
                                  <span>{answer}</span>
                                  {answer === currentQuiz.correctAnswer ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Quiz Statistics:</span>
                            <Badge variant="outline" className="bg-green-200">
                              {Array.from(quizAnswers.values()).filter(a => a === currentQuiz.correctAnswer).length} correct
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Total Answers:</span>
                              <span className="ml-2 font-medium">{Array.from(quizAnswers.entries()).length}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Correct Rate:</span>
                              <span className="ml-2 font-medium">
                                {Array.from(quizAnswers.entries()).length > 0
                                  ? ((Array.from(quizAnswers.values()).filter(a => a === currentQuiz.correctAnswer).length /
                                      Array.from(quizAnswers.entries()).length) * 100).toFixed(1)
                                  : 0}
                                %
                              </span>
                            </div>
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