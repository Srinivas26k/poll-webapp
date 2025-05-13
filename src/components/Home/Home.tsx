import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createSession = () => {
    if (!participantName.trim()) {
      setError('Please enter your name');
      return;
    }
    const newSessionId = Math.random().toString(36).substring(2, 8);
    localStorage.setItem('participantName', participantName);
    navigate(`/host?sessionId=${newSessionId}`);
  };

  const joinSession = () => {
    if (!sessionId.trim()) {
      setError('Please enter a session ID');
      return;
    }
    if (!participantName.trim()) {
      setError('Please enter your name');
      return;
    }
    localStorage.setItem('participantName', participantName);
    navigate(`/participant?sessionId=${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome to Live Poll</CardTitle>
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
                placeholder="Enter your name"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionId">Session ID</Label>
              <Input
                id="sessionId"
                placeholder="Enter session ID to join"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Button
                onClick={joinSession}
                className="w-full"
                variant="default"
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
                className="w-full"
                variant="outline"
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