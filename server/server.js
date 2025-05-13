require('dotenv').config();

const express = require('express');
const Pusher = require('pusher');
const cors = require('cors');
const router = express.Router();

const app = express();

// Verify environment variables
const requiredEnvVars = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
  encryptionMasterKeyBase64: process.env.PUSHER_ENCRYPTION_KEY
});

app.use(cors());
app.use(express.json());

// Basic routes
router.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

router.get('/sessions', (req, res) => {
  const activeSessions = Array.from(sessions.keys());
  res.json({ sessions: activeSessions });
});

app.use('/api', router);

// Store active sessions
const sessions = new Map();
const transcripts = new Map();

// Create session endpoint
router.post('/session/create', (req, res) => {
  const { sessionId } = req.body;
  console.log('Creating new session:', sessionId);
  
  try {
    sessions.set(sessionId, new Set());
    transcripts.set(sessionId, []);
    
    pusher.trigger(`session-${sessionId}`, 'session-created', {
      message: 'Session created successfully'
    }).then(() => {
      console.log('Successfully sent session creation via Pusher');
      res.json({ success: true, sessionId });
    }).catch((error) => {
      console.error('Error sending session creation via Pusher:', error);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    });
  } catch (error) {
    console.error('Error in session creation:', error);
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

// Join session endpoint
router.post('/session/join', (req, res) => {
  const { sessionId, userId } = req.body;
  const session = sessions.get(sessionId);
  if (session) {
    session.add(userId);
    pusher.trigger(`session-${sessionId}`, 'user-joined', {
      userId,
      message: 'User joined session'
    });
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Session not found' });
  }
});

// New transcription endpoint
router.post('/transcription', async (req, res) => {
  const { sessionId, text } = req.body;
  console.log(`Received transcription for session ${sessionId}:`, text);
  
  if (!sessionId || !text) {
    return res.status(400).json({ success: false, error: 'Missing sessionId or text' });
  }

  if (!sessions.get(sessionId)) {
    console.log(`Creating new session ${sessionId}`);
    sessions.set(sessionId, new Set());
    transcripts.set(sessionId, []);
  }

  const sessionTranscripts = transcripts.get(sessionId);
  const timestamp = Date.now();
  const transcriptEntry = { text, timestamp };
  sessionTranscripts.push(transcriptEntry);

  // Keep only last 10 minutes of transcripts
  const tenMinutesAgo = timestamp - 10 * 60 * 1000;
  const updatedTranscripts = sessionTranscripts.filter(t => t.timestamp > tenMinutesAgo);
  transcripts.set(sessionId, updatedTranscripts);
  
  try {
    await pusher.trigger(`session-${sessionId}`, 'new-transcription', {
      text,
      timestamp,
      fullTranscript: updatedTranscripts.map(t => t.text).join(' ')
    });
    
    console.log('Successfully sent transcription via Pusher');
    res.json({ success: true });
  } catch (error) {
    console.error('Error in transcription endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// New quiz endpoint
router.post('/quiz', async (req, res) => {
  const { sessionId, quiz } = req.body;
  console.log('Received quiz for session', sessionId, ':', quiz);

  if (!sessions.get(sessionId)) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  try {
    await pusher.trigger(`session-${sessionId}`, 'new-quiz', {
      quiz: {
        ...quiz,
        id: Date.now(), // Add unique ID to each quiz
        timestamp: Date.now()
      }
    });
    console.log('Successfully sent quiz via Pusher');
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending quiz:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit answer endpoint
router.post('/quiz/answer', (req, res) => {
  const { sessionId, userId, answer, questionId } = req.body;
  if (sessions.get(sessionId)) {
    pusher.trigger(`session-${sessionId}`, 'answer-submitted', {
      userId,
      answer,
      questionId
    });
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Session not found' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
