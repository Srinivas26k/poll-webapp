require('dotenv').config();

const express = require('express');
const Pusher = require('pusher');
const cors = require('cors');

const app = express();

// Verify environment variables
const requiredEnvVars = ['PUSHER_APP_ID', 'REACT_APP_PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.REACT_APP_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

app.use(cors());
app.use(express.json());

// Store active sessions and their data
const sessions = new Map();
const transcripts = new Map();
const activeQuizzes = new Map();
const participants = new Map();

// Helper function to broadcast participants update
const broadcastParticipantsUpdate = async (sessionId) => {
  const sessionParticipants = participants.get(sessionId);
  if (sessionParticipants) {
    const participantsList = Array.from(sessionParticipants.values());
    await pusher.trigger(`session-${sessionId}`, 'participants-update', {
      participants: participantsList
    });
  }
};

// Create session endpoint
app.post('/api/session/create', async (req, res) => {
  const { name, host } = req.body;
  if (!name || !host || !host.name || !host.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sessionId = Math.random().toString(36).substring(2, 8);
  console.log('Creating new session:', sessionId);
  
  try {
    const session = {
      id: sessionId,
      name,
      host,
      participants: [],
      createdAt: Date.now()
    };

    sessions.set(sessionId, session);
    transcripts.set(sessionId, []);
    activeQuizzes.set(sessionId, new Map());
    participants.set(sessionId, new Map());

    // Add host as first participant
    participants.get(sessionId).set(host.email, host.name);
    await broadcastParticipantsUpdate(sessionId);
    
    await pusher.trigger(`session-${sessionId}`, 'session-created', {
      session
    });

    console.log('Successfully sent session creation via Pusher');
    res.json({ 
      success: true, 
      sessionId, 
      session: {
        id: sessionId,
        name,
        host,
        participants: [],
        createdAt: session.createdAt
      }
    });
  } catch (error) {
    console.error('Error in session creation:', error);
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

// Join session endpoint
app.post('/api/session/join', async (req, res) => {
  const { sessionId, participant } = req.body;
  if (!sessionId || !participant || !participant.name || !participant.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    // Add participant to the session
    session.participants.push(participant);
    participants.get(sessionId).set(participant.email, participant.name);

    // Broadcast participant joined event
    await pusher.trigger(`session-${sessionId}`, 'user-joined', {
      userId: participant.email,
      name: participant.name
    });

    // Broadcast updated participants list
    await broadcastParticipantsUpdate(sessionId);

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// Leave session endpoint
app.post('/api/session/leave', async (req, res) => {
  const { sessionId, userId } = req.body;
  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    // Remove participant from the session
    session.participants = session.participants.filter(p => p.email !== userId);
    participants.get(sessionId).delete(userId);

    // Broadcast updated participants list
    await broadcastParticipantsUpdate(sessionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving session:', error);
    res.status(500).json({ error: 'Failed to leave session' });
  }
});

// End session endpoint
app.post('/api/session/end', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    // Broadcast session ended event
    await pusher.trigger(`session-${sessionId}`, 'session-ended', {
      sessionId,
      message: 'Session has ended'
    });

    // Clean up session data
    sessions.delete(sessionId);
    transcripts.delete(sessionId);
    activeQuizzes.delete(sessionId);
    participants.delete(sessionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Transcription endpoint
app.post('/api/transcription', async (req, res) => {
  const { sessionId, text } = req.body;
  if (!sessionId || !text) {
    return res.status(400).json({ error: 'Missing sessionId or text' });
  }

  try {
    // Split text into chunks if it's too large
    const maxChunkSize = 8000;
    const chunks = [];
    let currentChunk = '';
    
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          const words = sentence.split(' ');
          for (const word of words) {
            if ((currentChunk + word + ' ').length > maxChunkSize) {
              chunks.push(currentChunk);
              currentChunk = word + ' ';
            } else {
              currentChunk += word + ' ';
            }
          }
        }
      } else {
        currentChunk += sentence + ' ';
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // Store transcript
    const sessionTranscripts = transcripts.get(sessionId) || [];
    sessionTranscripts.push(text);
    transcripts.set(sessionId, sessionTranscripts);

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await pusher.trigger(`session-${sessionId}`, 'new-transcription', {
        text: chunk,
        isPartial: i < chunks.length - 1,
        timestamp: Date.now(),
        chunkIndex: i,
        totalChunks: chunks.length
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in transcription endpoint:', error);
    res.status(500).json({ error: 'Failed to process transcription' });
  }
});

// Quiz endpoint
app.post('/api/quiz', async (req, res) => {
  const { sessionId, quiz } = req.body;
  if (!sessionId || !quiz) {
    return res.status(400).json({ error: 'Missing sessionId or quiz' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const quizData = {
      ...quiz,
      timestamp: Date.now(),
      answers: new Map()
    };

    // Store the active quiz
    activeQuizzes.get(sessionId).set(quiz.id, quizData);

    // Set a timeout to end the quiz
    setTimeout(async () => {
      const quiz = activeQuizzes.get(sessionId)?.get(quizData.id);
      if (quiz) {
        const answersWithNames = Array.from(quiz.answers.entries()).map(([userId, answer]) => ({
          userId,
          name: participants.get(sessionId)?.get(userId) || 'Anonymous',
          answer
        }));

        await pusher.trigger(`session-${sessionId}`, 'quiz-ended', {
          quizId: quizData.id,
          answers: answersWithNames
        });

        activeQuizzes.get(sessionId).delete(quizData.id);
      }
    }, (quiz.timeLimit || 60) * 1000);

    await pusher.trigger(`session-${sessionId}`, 'new-quiz', {
      quiz: quizData
    });

    console.log('Successfully sent quiz via Pusher');
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending quiz:', error);
    res.status(500).json({ error: 'Failed to send quiz' });
  }
});

// Submit answer endpoint
app.post('/api/quiz/answer', async (req, res) => {
  const { sessionId, userId, answer, questionId } = req.body;
  if (!sessionId || !userId || !answer || !questionId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const session = sessions.get(sessionId);
  const quiz = activeQuizzes.get(sessionId)?.get(questionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!quiz) {
    return res.status(400).json({ error: 'Quiz is no longer active' });
  }

  try {
    // Store the answer
    quiz.answers.set(userId, answer);

    // Broadcast the answer submission
    await pusher.trigger(`session-${sessionId}`, 'answer-submitted', {
      userId,
      name: participants.get(sessionId)?.get(userId) || 'Anonymous',
      answer,
      questionId,
      timestamp: Date.now()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Get session details endpoint
app.get('/api/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
