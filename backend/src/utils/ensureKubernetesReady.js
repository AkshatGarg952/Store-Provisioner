import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KIND_CONFIG_PATH = path.resolve(__dirname, '../../kind-config.yaml');

async function testKubernetesConnectivity() {
    try {
        await execAsync('kubectl cluster-info', { timeout: 5000 });
        return true;
    } catch (err) {
        return false;
    }
}

async function resetKindCluster() {
    console.log('Resetting Kubernetes cluster...');

    try {
        await execAsync('kind delete cluster');
        console.log('Deleted existing Kind cluster');
    } catch (err) {
        console.log('No existing cluster to delete (this is fine)');
    }

    console.log('Creating new Kind cluster with ingress port mappings...');
    await execAsync(`kind create cluster --config="${KIND_CONFIG_PATH}"`);
    console.log('Kind cluster created');

    console.log('Installing nginx ingress controller...');
    await execAsync('kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml');

    console.log('Waiting for ingress controller to be ready...');
    await execAsync(
        'kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s'
    );

    console.log('Kubernetes cluster is ready');
}

export async function ensureKubernetesReady() {
    console.log('Checking Kubernetes cluster status...');

    const isReady = await testKubernetesConnectivity();

    if (isReady) {
        console.log('Kubernetes cluster is accessible');
        return true;
    }

    console.log('Kubernetes cluster is not accessible, attempting recovery...');

    try {
        await resetKindCluster();
        return true;
    } catch (err) {
        console.error('Failed to reset Kubernetes cluster:', err.message);
        return false;
    }
}
