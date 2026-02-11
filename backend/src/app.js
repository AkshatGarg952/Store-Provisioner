import express from 'express';
import cors from 'cors';
import storeRoutes from './routes/storeRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', storeRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Database Init
import { initDB } from './db/init.js';
initDB();

// Start Reconciliation Loop
import { reconcileAllStores } from './services/kubernetesService.js';

const RECONCILIATION_INTERVAL = 60 * 1000; // 60 seconds

// Run once on startup (after a slight delay to allow DB init)
setTimeout(() => {
    reconcileAllStores();
}, 5000);

// Run periodically
setInterval(() => {
    reconcileAllStores();
}, RECONCILIATION_INTERVAL);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});