import express from 'express';
import cors from 'cors';
import storeRoutes from './routes/storeRoutes.js';
import { ensureKubernetesReady } from './utils/ensureKubernetesReady.js';

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

// Server startup function with Kubernetes health check
async function startServer() {
    // Verify Kubernetes is accessible before starting
    const k8sReady = await ensureKubernetesReady();
    if (!k8sReady) {
        console.error('Cannot start server: Kubernetes cluster is not accessible');
        process.exit(1);
    }

    // Database Init
    const { initDB } = await import('./db/init.js');
    initDB();

    // Start Reconciliation Loop
    const { reconcileAllStores } = await import('./services/kubernetesService.js');

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
}

startServer();
