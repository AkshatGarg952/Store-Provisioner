import express from 'express';
import cors from 'cors';
import storeRoutes from './routes/storeRoutes.js';
import { ensureKubernetesReady } from './utils/ensureKubernetesReady.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', storeRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

async function startServer() {
    const k8sReady = await ensureKubernetesReady();
    if (!k8sReady) {
        console.error('Cannot start server: Kubernetes cluster is not accessible');
        process.exit(1);
    }

    const { initDB } = await import('./db/init.js');
    initDB();

    const { reconcileAllStores } = await import('./services/kubernetesService.js');

    const RECONCILIATION_INTERVAL = 60 * 1000;

    setTimeout(() => {
        reconcileAllStores();
    }, 5000);

    setInterval(() => {
        reconcileAllStores();
    }, RECONCILIATION_INTERVAL);

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
