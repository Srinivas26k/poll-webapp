import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Session, UserDetails, Poll, SessionCreationParams, SessionJoinParams } from '../../src/types';

const sessions = new Map<string, Session>();

export const createSession = (req: Request<{}, {}, SessionCreationParams>, res: Response) => {
  try {
    const sessionId = uuidv4();
    const { name, host } = req.body;

    if (!name || !host.email || !host.name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hostWithId: UserDetails = {
      ...host,
      userId: uuidv4()
    };

    const newSession: Session = {
      id: sessionId,
      name,
      hostId: hostWithId.userId,
      host: hostWithId,
      participants: [],
      createdAt: Date.now(),
      status: 'active',
      transcripts: [],
      polls: []
    };

    sessions.set(sessionId, newSession);
    res.json({ 
      sessionId,
      session: newSession
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

export const joinSession = (req: Request<{}, {}, SessionJoinParams>, res: Response) => {
  try {
    const { sessionId, participant } = req.body;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!participant.email || !participant.name) {
      return res.status(400).json({ error: 'Missing participant details' });
    }

    // Check if session is still active
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session has ended' });
    }

    // Check if participant already exists
    const existingParticipant = session.participants.find(p => p.email === participant.email);
    if (existingParticipant) {
      return res.status(400).json({ error: 'User already in session' });
    }

    // Add participant with a userId
    const participantWithId: UserDetails = {
      ...participant,
      userId: uuidv4()
    };
    
    session.participants.push(participantWithId);
    res.json({ 
      success: true,
      session: {
        id: session.id,
        name: session.name,
        hostId: session.hostId,
        participantId: participantWithId.userId
      }
    });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
};

export const endSession = (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'ended';
    res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
};

export const getSessionDetails = (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ error: 'Failed to get session details' });
  }
};

export const addTranscript = (req: Request, res: Response) => {
  try {
    const { sessionId, transcript } = req.body;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.transcripts) {
      session.transcripts = [];
    }
    session.transcripts.push(transcript);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding transcript:', error);
    res.status(500).json({ error: 'Failed to add transcript' });
  }
};

export const getTranscripts = (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session.transcripts || []);
  } catch (error) {
    console.error('Error getting transcripts:', error);
    res.status(500).json({ error: 'Failed to get transcripts' });
  }
};
