import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generateQuizFromTranscript } from '../../services/aiService';
import { subscribeToPusher } from '../../services/pusherService';

const Host: React.FC = () => {  
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [quizInterval, setQuizInterval] = useState<number>(5);
  const [lastQuizTime, setLastQuizTime] = useState<number>(Date.now());
  const [transcriptBuffer, setTranscriptBuffer] = useState<string>('');
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (sessionId) {
      const cleanup = subscribeToPusher(sessionId, {
        onUserJoined: (data) => {
          setConnectedUsers(prev => [...prev, data.userId]);
        }
      });

      // Create session on the server
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
      const recognition: SpeechRecognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        handleTranscriptUpdate(currentTranscript);
      };

      setRecognition(recognition);
    }
  }, [sessionId]);

  useEffect(() => {
    const checkQuizGeneration = async () => {
      const now = Date.now();
      if (isRecording && transcriptBuffer && 
          (now - lastQuizTime) > (quizInterval * 60 * 1000)) {
        try {
          const quiz = await generateQuizFromTranscript(transcriptBuffer);
          
          // Send the quiz using the server endpoint
          await fetch(`${process.env.REACT_APP_SERVER_URL}/api/quiz`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId, quiz }),
          });

          setLastQuizTime(now);
          setTranscriptBuffer(''); // Clear buffer after quiz generation
        } catch (error) {
          console.error('Error generating quiz:', error);
        }
      }
    };

    const interval = setInterval(checkQuizGeneration, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [isRecording, lastQuizTime, quizInterval, sessionId, transcriptBuffer]);

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
    } else {
      recognition?.start();
    }
    setIsRecording(!isRecording);
  };
  const handleTranscriptUpdate = async (text: string) => {
    try {
      setTranscript(prevTranscript => prevTranscript + ' ' + text);
      setTranscriptBuffer(prevBuffer => prevBuffer + ' ' + text);
      
      // Send transcription using the server endpoint
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

      console.log('Transcription sent successfully');
    } catch (error) {
      console.error('Error sending transcription:', error);
    }
  };

  const handleIntervalChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setQuizInterval(Number(event.target.value));
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Host Session</h1>
          <p className="mb-4">Session ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{sessionId}</span></p>
          <div className="mb-4">
            <p className="text-sm text-gray-600">Connected users: {connectedUsers.length}</p>
          </div>
          <div className="flex space-x-4 mb-6">
            <button
              onClick={toggleRecording}
              className={`px-4 py-2 rounded ${
                isRecording ? 'bg-red-500' : 'bg-green-500'
              } text-white`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            
            <select
              value={quizInterval}
              onChange={handleIntervalChange}
              className="px-4 py-2 rounded border border-gray-300"
            >
              <option value="1">Every 1 minute</option>
              <option value="2">Every 2 minutes</option>
              <option value="5">Every 5 minutes</option>
              <option value="10">Every 10 minutes</option>
            </select>
            <span className="flex items-center text-sm text-gray-600">
              Next quiz in: {Math.max(0, Math.round((quizInterval * 60 * 1000 - (Date.now() - lastQuizTime)) / 1000))} seconds
            </span>
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
