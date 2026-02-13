import express from 'express';
const router = express.Router();
import * as storeController from '../controllers/storeController.js';
import * as authController from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/verify', verifyToken, authController.verify);

router.get('/stores', verifyToken, storeController.getAllStores);
router.get('/stores/:id', verifyToken, storeController.getStore);
router.post('/stores', verifyToken, storeController.createStore);
router.delete('/stores/:id', verifyToken, storeController.deleteStore);
router.get('/stores/:id/events', verifyToken, storeController.getStoreEvents);

export default router;
