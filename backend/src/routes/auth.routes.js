import { Router } from 'express';
import { login, getMe, logout, registerInstitute } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.post('/register-institute', registerInstitute);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
