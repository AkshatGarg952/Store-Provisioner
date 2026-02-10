import { KubeConfig, CoreV1Api, AppsV1Api } from '@kubernetes/client-node';
import crypto from 'crypto';

const kc = new KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(CoreV1Api);
const k8sAppsApi = kc.makeApiClient(AppsV1Api);

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const STORE_LABEL_SELECTOR = 'type=store-tenant';


export const listStores = async () => {
    try {
        const res = await k8sApi.listNamespace({
            labelSelector: STORE_LABEL_SELECTOR
        });


        const stores = await Promise.all(res.items.map(async (ns) => {
            const annotations = ns.metadata.annotations || {};
            const labels = ns.metadata.labels || {};

            // Ignore namespaces that are being deleted
            if (ns.status.phase === 'Terminating') return null;

            const id = labels['store-id'];
            if (!id) return null; // Ignore namespaces that aren't stores

            const name = annotations['store-name'] || 'Unknown';
            const engine = annotations['store-engine'];
            const createdAt = annotations['created-at'];
            const status = await checkStoreStatus(id);

            return {
                id,
                name,
                engine,
                url: `http://store-${id}.local`, // Guessing the URL based on the ingress convention
                status,
                createdAt
            };
        }));

        return stores.filter(s => s !== null);


    } catch (err) {
        console.error('Error listing stores:', err);
        return [];
    }
};


export const getStore = async (storeId) => {
    try {
        // We're relying on the convention that the namespace is always named 'store-{id}'
        const namespaceName = `store-${storeId}`;
        const res = await k8sApi.readNamespace({ name: namespaceName });
        const ns = res;

        const name = ns.metadata.annotations['store-name'];
        const engine = ns.metadata.annotations['store-engine'];
        const createdAt = ns.metadata.annotations['created-at'];
        const status = await checkStoreStatus(storeId);

        return {
            id: storeId,
            name,
            engine,
            url: `http://store-${storeId}.local`,
            status,
            createdAt
        };
    } catch (err) {
        if (err.statusCode === 404 || err.code === 404 || (err.response && err.response.statusCode === 404)) {
            return null;
        }
        console.error(`Error getting store ${storeId}:`, err);
        throw err;
    }
};


export const createStore = async (storeId, name, engine) => {
    const namespaceName = `store-${storeId}`;
    try {
        const namespace = {
            metadata: {
                name: namespaceName,
                labels: {
                    'type': 'store-tenant',
                    'managedBy': 'store-provisioner',
                    'store-id': storeId
                },
                annotations: {
                    'store-name': name,
                    'store-engine': engine,
                    'created-at': new Date().toISOString()
                }
            }
        };

        await k8sApi.createNamespace({ body: namespace });
        console.log(`Created namespace: ${namespaceName}`);

        // --- Isolation & Guardrails ---
        // 1. ResourceQuota
        const quota = {
            apiVersion: 'v1',
            kind: 'ResourceQuota',
            metadata: { name: 'store-quota', namespace: namespaceName },
            spec: {
                hard: {
                    'requests.cpu': '1',
                    'requests.memory': '1Gi',
                    'limits.cpu': '2',
                    'limits.memory': '2Gi',
                    'pods': '10',
                    'persistentvolumeclaims': '5'
                }
            }
        };
        await k8sApi.createNamespacedResourceQuota({ namespace: namespaceName, body: quota });

        // 2. LimitRange
        const limitRange = {
            apiVersion: 'v1',
            kind: 'LimitRange',
            metadata: { name: 'store-limit-range', namespace: namespaceName },
            spec: {
                limits: [{
                    type: 'Container',
                    default: { memory: '512Mi', cpu: '500m' },
                    defaultRequest: { memory: '256Mi', cpu: '100m' }
                }]
            }
        };
        await k8sApi.createNamespacedLimitRange({ namespace: namespaceName, body: limitRange });
        console.log(`Applied isolation policies (Quota & Limits) to ${namespaceName}`);
        // -----------------------------

        return {
            id: storeId,
            name,
            status: 'Provisioning',
            createdAt: namespace.metadata.annotations['created-at']
        };
    } catch (err) {
        if (err.response && err.response.body.code === 409) {
            console.log(`Namespace ${namespaceName} already exists.`);
            return await getStore(storeId);
        }
        console.error(`Error creating namespace: ${err}`);
        throw err;
    }
};


export const deleteStore = async (storeId) => {
    const namespaceName = `store-${storeId}`;
    try {
        await k8sApi.deleteNamespace({ name: namespaceName });
        console.log(`Deleted namespace: ${namespaceName}`);
        return true;
    } catch (err) {
        if (err.statusCode === 404 || err.code === 404 || (err.response && err.response.body.code === 404)) {
            return false;
        }
        console.error(`Error deleting namespace: ${err}`);
        throw err;
    }
};


export const checkStoreStatus = async (storeId) => {
    const namespaceName = `store-${storeId}`;
    try {
        // Grab both Deployments and StatefulSets to get the full picture
        const deployments = await k8sAppsApi.listNamespacedDeployment({ namespace: namespaceName });
        const statefulsets = await k8sAppsApi.listNamespacedStatefulSet({ namespace: namespaceName });

        const allDeployments = [...deployments.items, ...statefulsets.items];

        if (allDeployments.length === 0) {
            // If there's nothing here yet, the provisioner is likely just starting up
            return 'Provisioning';
        }

        // We consider it 'Ready' only if every single requested replica is up and running
        const allReady = allDeployments.every(res => {
            const specReplicas = res.spec.replicas || 1;
            const readyReplicas = res.status.readyReplicas || 0;
            return readyReplicas >= specReplicas;
        });

        return allReady ? 'Ready' : 'Provisioning';

    } catch (err) {
        // This usually happens if the namespace is gone or in the middle of being deleted
        console.error(`Error checking status for ${storeId}:`, err);
        return 'Unknown';
    }
};







// Helper to check if a release exists
const helmReleaseExists = (releaseName, namespace) => {
    return new Promise((resolve) => {
        exec(`helm status ${releaseName} --namespace ${namespace}`, (error) => {
            resolve(!error);
        });
    });
};

export const ensureHelmRelease = async (storeId, engine) => {
    const namespace = `store-${storeId}`;
    const releaseName = `store-${storeId}`;

    // Check if installed
    if (await helmReleaseExists(releaseName, namespace)) {
        // In a real operator, we might check for upgrades here.
        // For now, if it exists, we assume it's good.
        return true;
    }

    return installHelmChart(storeId, engine);
};

export const installHelmChart = (storeId, engine) => {
    return new Promise((resolve, reject) => {
        const namespace = `store-${storeId}`;
        const releaseName = `store-${storeId}`;
        // Path to your helm chart
        const chartPath = path.resolve(__dirname, '../../../helm', engine);

        // Hostname for access
        const domainSuffix = process.env.INGRESS_DOMAIN_SUFFIX || 'local';
        const host = `store-${storeId}.${domainSuffix}`;

        // Generate random passwords (in real app, use crypto)
        const dbPassword = crypto.randomBytes(16).toString('hex');
        const rootPassword = crypto.randomBytes(16).toString('hex');

        // Construct helm install command
        // We set values explicitly via --set to override values.yaml
        // Note: For Bitnami charts, use specific values like mysql.auth.password
        const command = `helm install ${releaseName} ${chartPath} ` +
            `--namespace ${namespace} ` +
            `--set ingress.host=${host} ` +
            `--set mysql.auth.password=${dbPassword} ` +
            `--set mysql.auth.rootPassword=${rootPassword}`;

        console.log(`Executing Helm install for ${storeId} using engine ${engine}...`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Helm install error: ${stderr}`);
                reject(error);
                return;
            }
            console.log(`Helm stdout: ${stdout}`);
            resolve(true);
        });
    });
};

export const uninstallHelmChart = (storeId) => {
    return new Promise((resolve, reject) => {
        const namespace = `store-${storeId}`;
        const releaseName = `store-${storeId}`;

        exec(`helm uninstall ${releaseName} --namespace ${namespace}`, (error, stdout, stderr) => {
            if (error) {
                // Ignore if release not found
                console.warn(`Helm uninstall warning: ${stderr}`);
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
};

// Reconcile Loop: Ensures all stores that *should* exist *do* have their resources
export const reconcileAllStores = async () => {
    console.log('Running reconciliation loop...');
    const stores = await listStores();

    for (const store of stores) {
        // Skip if it's already considered Ready by Pod status
        // Actually, we should check if Helm release exists even if pods are running (edge case)
        // But for efficiency, let's just target "Provisioning" state OR missing releases?

        // Safer approach: Ensure Helm release for ALL non-terminating stores
        try {
            // We need to know the engine from the store object. 
            // listStores returns engine from annotation.
            if (store.engine && store.engine !== 'medusajs') {
                await ensureHelmRelease(store.id, store.engine);
            }
        } catch (err) {
            console.error(`Failed to reconcile store ${store.id}:`, err);
        }
    }
};
