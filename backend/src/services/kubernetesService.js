import { KubeConfig, CoreV1Api, AppsV1Api } from '@kubernetes/client-node';

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







export const installHelmChart = (storeId, engine) => {
    return new Promise((resolve, reject) => {
        const namespace = `store-${storeId}`;
        const releaseName = `store-${storeId}`;
        // Path to your helm chart
        const chartPath = path.resolve(__dirname, '../../../helm', engine);

        // Hostname for local access
        const host = `store-${storeId}.local`;

        // Generate random passwords (in real app, use crypto)
        const dbPassword = 'password123';
        const rootPassword = 'password123';

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
