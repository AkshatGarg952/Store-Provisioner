import express from 'express';
const router = express.Router();
import * as storeController from '../controllers/storeController.js';


// List all stores
router.get('/', storeController.getAllStores);

// Get specific store
router.get('/:id', storeController.getStore);

// Create a new store
router.post('/', storeController.createStore);

// Delete a store
router.delete('/:id', storeController.deleteStore);

export default router;