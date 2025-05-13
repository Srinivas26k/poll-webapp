import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface Session {
  id: string;
  hostId: string;
  participants: string[];
  transcripts: string[];
  polls: Poll[];
}

interface Poll {
  id: string;
  question: string;
  options: string[];
  responses: { userId: string; answer: string }[];
}

const sessions = new Map<string, Session>();

export const createSession = (req: Request, res: Response) => {
  const sessionId = uuidv4();
  const hostId = req.body.hostId;

  sessions.set(sessionId, {
    id: sessionId,
    hostId,
    participants: [],
    transcripts: [],
    polls: []
  });

  res.json({ sessionId });
};

export const joinSession = (req: Request, res: Response) => {
  const { sessionId, participantId } = req.body;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.participants.push(participantId);
  res.json({ success: true });
};

export const getSessionDetails = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session);
};

export const addTranscript = (req: Request, res: Response) => {
  const { sessionId, transcript } = req.body;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.transcripts.push(transcript);
  res.json({ success: true });
};

export const getTranscripts = (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session.transcripts);
};
