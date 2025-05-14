import { Request, Response } from 'express';
import { Session, UserDetails } from '../types';

// In-memory store for sessions (replace with database in production)
const sessions = new Map<string, Session>();

export const joinSession = async (req: Request, res: Response) => {
  try {
    const { sessionId, participant } = req.body as { sessionId: string; participant: UserDetails };

    if (!sessionId || !participant) {
      return res.status(400).json({ message: 'Session ID and participant details are required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({ message: 'Session has ended' });
    }

    // Check if participant is already in the session
    const existingParticipant = session.participants.find((p: UserDetails) => p.email === participant.email);
    if (existingParticipant) {
      return res.status(200).json({ message: 'Already joined session' });
    }

    // Add participant to session
    session.participants.push(participant);

    // Update session in store
    sessions.set(sessionId, session);

    return res.status(200).json({ message: 'Successfully joined session' });
  } catch (error) {
    console.error('Error joining session:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ... rest of the controller code ... 