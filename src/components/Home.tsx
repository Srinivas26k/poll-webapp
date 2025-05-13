import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const [sessionId, setSessionId] = useState('');
  const navigate = useNavigate();

  const createSession = () => {
    const newSessionId = Math.random().toString(36).substring(2, 8);
    navigate(`/host?sessionId=${newSessionId}`);
  };

  const joinSession = () => {
    if (sessionId) {
      navigate(`/participant?sessionId=${sessionId}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Live Transcription Quiz</h1>
        
        <div className="space-y-4">
          <button
            onClick={createSession}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
          >
            Create Session (Host)
          </button>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter Session ID"
              className="flex-1 border rounded px-3 py-2"
            />
            <button
              onClick={joinSession}
              className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
