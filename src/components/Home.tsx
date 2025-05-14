import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserDetails } from '../types';

const Home: React.FC = () => {
  const [sessionId, setSessionId] = useState('');
  const [userDetails, setUserDetails] = useState<UserDetails>({
    name: '',
    email: ''
  });
  const [isFormValid, setIsFormValid] = useState(false);
  const navigate = useNavigate();

  const handleUserDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserDetails(prev => ({
      ...prev,
      [name]: value
    }));
    // Validate form
    setIsFormValid(
      name === 'name' 
        ? value.trim() !== '' && userDetails.email.trim() !== ''
        : userDetails.name.trim() !== '' && value.trim() !== ''
    );
  };

  const createSession = async () => {
    if (!isFormValid) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Session',
          host: userDetails
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      // Store user details in localStorage
      localStorage.setItem('userId', userDetails.email);
      navigate(`/host?sessionId=${data.sessionId}`);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
    }
  };

  const joinSession = async () => {
    if (!isFormValid || !sessionId) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/session/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          participant: userDetails
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to join session');
      }

      // Store user details in localStorage
      localStorage.setItem('userId', userDetails.email);
      navigate(`/participant?sessionId=${sessionId}`);
    } catch (error) {
      console.error('Error joining session:', error);
      alert('Failed to join session. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Live Transcription Quiz</h1>
        
        <div className="space-y-4">
          {/* User Details Form */}
          <div className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={userDetails.name}
                onChange={handleUserDetailsChange}
                placeholder="Enter your name"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={userDetails.email}
                onChange={handleUserDetailsChange}
                placeholder="Enter your email"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <button
            onClick={createSession}
            disabled={!isFormValid}
            className={`w-full py-2 px-4 rounded transition-colors ${
              isFormValid 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Create Session (Host)
          </button>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter Session ID"
              className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={joinSession}
              disabled={!isFormValid || !sessionId}
              className={`py-2 px-4 rounded transition-colors ${
                isFormValid && sessionId
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
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
