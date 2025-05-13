import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

const Host: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [isRecording, setIsRecording] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000');
    setSocket(newSocket);

    if (sessionId) {
      newSocket.emit('create-session', sessionId);
    }

    return () => {
      newSocket.close();
    };
  }, [sessionId]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        socket?.emit('transcription', { sessionId, text: currentTranscript });
      };

      setRecognition(recognition);
    }
  }, [sessionId, socket]);

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
    } else {
      recognition?.start();
    }
    setIsRecording(!isRecording);
  };

  const generateQuiz = () => {
    socket?.emit('generate-quiz', { sessionId });
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Host Session</h1>
          <p className="mb-4">Session ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{sessionId}</span></p>
          
          <div className="flex space-x-4 mb-6">
            <button
              onClick={toggleRecording}
              className={`px-4 py-2 rounded ${
                isRecording ? 'bg-red-500' : 'bg-green-500'
              } text-white`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            
            <button
              onClick={generateQuiz}
              className="px-4 py-2 rounded bg-blue-500 text-white"
            >
              Generate Quiz
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Live Transcript:</h2>
            <p className="whitespace-pre-wrap">{transcript}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Host;
