import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KIND_CONFIG_PATH = path.resolve(__dirname, '../../kind-config.yaml');

/**
 * Tests if kubectl can connect to the Kubernetes cluster.
 * Uses a short timeout to fail fast if the cluster is unreachable.
 */
async function testKubernetesConnectivity() {
    try {
        await execAsync('kubectl cluster-info', { timeout: 5000 });
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Recreates the Kind cluster from scratch.
 * This is necessary when the cluster becomes corrupted after system/Docker restarts.
 * The process involves: deleting the old cluster, creating a new one, and setting up ingress.
 */
async function resetKindCluster() {
    console.log('Resetting Kubernetes cluster...');

    // Delete the existing cluster (may fail if already deleted, but that's okay)
    try {
        await execAsync('kind delete cluster');
        console.log('Deleted existing Kind cluster');
    } catch (err) {
        console.log('No existing cluster to delete (this is fine)');
    }

    // Create a fresh cluster with port mappings for ingress
    console.log('Creating new Kind cluster with ingress port mappings...');
    await execAsync(`kind create cluster --config="${KIND_CONFIG_PATH}"`);
    console.log('Kind cluster created');

    // Install nginx ingress controller (required for store routing)
    console.log('Installing nginx ingress controller...');
    await execAsync('kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml');

    // Wait for ingress to be ready before proceeding
    console.log('Waiting for ingress controller to be ready...');
    await execAsync(
        'kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s'
    );

    console.log('Kubernetes cluster is ready');
}

/**
 * Ensures Kubernetes is accessible before the server starts.
 * If the cluster is broken (common after restarts), automatically recreates it.
 */
export async function ensureKubernetesReady() {
    console.log('Checking Kubernetes cluster status...');

    const isReady = await testKubernetesConnectivity();

    if (isReady) {
        console.log('Kubernetes cluster is accessible');
        return true;
    }

    // Cluster is not accessible, attempt to reset it
    console.log('Kubernetes cluster is not accessible, attempting recovery...');

    try {
        await resetKindCluster();
        return true;
    } catch (err) {
        console.error('Failed to reset Kubernetes cluster:', err.message);
        return false;
    }
}
