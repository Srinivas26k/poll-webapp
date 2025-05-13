import { Router } from 'express';
import { createSession, joinSession, getSessionDetails, addTranscript, getTranscripts } from '../controllers/sessionController';
import { createQuiz, submitAnswer, getQuizResults } from '../controllers/quizController';

const router = Router();

// Session routes
router.post('/session/create', createSession);
router.post('/session/join', joinSession);
router.get('/session/:sessionId', getSessionDetails);
router.post('/session/transcript', addTranscript);
router.get('/session/:sessionId/transcripts', getTranscripts);

// Quiz routes
router.post('/quiz/create', createQuiz);
router.post('/quiz/answer', submitAnswer);
router.get('/quiz/:quizId/results', getQuizResults);

export const setupSessionRoutes = (app: any) => {
  app.use('/api', router);
};
