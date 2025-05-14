import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle } from 'lucide-react';
import { UserDetails } from '../../types/index';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    sessionId: '',
    name: '',
    email: '',
    sessionName: ''
  });
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const createSession = async () => {
    const { name, email, sessionName } = formData;
    
    if (!name.trim() || !email.trim() || !sessionName.trim()) {
      setError('Please fill in all fields to create a session.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      const response = await fetch(`${process.env.SERVER_URL}/api/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sessionName,
          host: {
            name,
            email
          }
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      localStorage.setItem('participantName', name);
      localStorage.setItem('email', email);
      localStorage.setItem('sessionName', sessionName);
      navigate(`/host?sessionId=${data.sessionId}`);
    } catch (error) {
      console.error('Error creating session:', error);
      setError('Failed to create session. Please try again.');
    }
  };

  const joinSession = async () => {
    const { sessionId, name, email } = formData;

    if (!sessionId.trim() || !name.trim() || !email.trim()) {
      setError('Please fill in all fields to join a session.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      const response = await fetch(`${process.env.SERVER_URL}/api/session/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          participant: {
            name,
            email
          }
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join session');
      }

      localStorage.setItem('participantName', name);
      localStorage.setItem('email', email);
      navigate(`/participant?sessionId=${sessionId}`);
    } catch (error) {
      console.error('Error joining session:', error);
      setError('Failed to join session. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl text-center font-bold text-gray-800">Live Transcription Quiz</CardTitle>
          <p className="text-center text-gray-600">Create or join a live polling session</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter your name"
                value={formData.name}
                onChange={handleInputChange}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionName">Session Name (for creating a session)</Label>
              <Input
                id="sessionName"
                name="sessionName"
                placeholder="Enter session name"
                value={formData.sessionName}
                onChange={handleInputChange}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionId">Session ID (for joining a session)</Label>
              <Input
                id="sessionId"
                name="sessionId"
                placeholder="Enter session ID to join"
                value={formData.sessionId}
                onChange={handleInputChange}
                className="h-11"
              />
            </div>

            <div className="flex flex-col space-y-3">
              <Button
                onClick={joinSession}
                className="w-full h-11"
                variant="default"
                disabled={!formData.sessionId || !formData.name || !formData.email}
              >
                Join Session
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>
              <Button
                onClick={createSession}
                className="w-full h-11"
                variant="outline"
                disabled={!formData.name || !formData.email || !formData.sessionName}
              >
                Create New Session
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;