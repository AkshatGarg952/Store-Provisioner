import { KubeConfig, CoreV1Api, AppsV1Api } from '@kubernetes/client-node';

const kc = new KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(CoreV1Api);
const k8sAppsApi = kc.makeApiClient(AppsV1Api);

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

            const id = labels['store-id'];
            if (!id) return null; // Ignore namespaces that aren't stores

            const name = annotations['store-name'] || 'Unknown';
            const createdAt = annotations['created-at'];
            const status = await checkStoreStatus(id);

            return {
                id,
                name,
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
        const createdAt = ns.metadata.annotations['created-at'];
        const status = await checkStoreStatus(storeId);

        return {
            id: storeId,
            name,
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


export const createStore = async (storeId, name) => {
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
