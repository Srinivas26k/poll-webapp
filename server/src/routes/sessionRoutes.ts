import { Router } from 'express';
import { joinSession } from '../controllers/sessionController';

const router = Router();

router.post('/join', joinSession);

export default router; 