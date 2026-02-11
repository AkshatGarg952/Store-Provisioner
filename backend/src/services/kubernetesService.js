import { KubeConfig, CoreV1Api, AppsV1Api } from '@kubernetes/client-node';
import crypto from 'crypto';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from '../models/Store.js';
import * as eventService from './eventService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// K8s Clients
const kc = new KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(CoreV1Api);
const k8sAppsApi = kc.makeApiClient(AppsV1Api);

// Concurrency Control
let currentProvisioningCount = 0;
const MAX_CONCURRENT = 2;
const PROVISION_TIMEOUT_MS = 900000; // 15 minutes - WordPress initialization is slow

// Helper for Status Updates
const updateStoreStatus = async (storeId, status, errorReason = null) => {
    try {
        await Store.update({ status, errorReason }, { where: { id: storeId } });
    } catch (err) {
        console.error(`Failed to update store status via DB: ${err}`);
    }
};

// Helper for Timeout
const withTimeout = (promise, ms, timeoutErrorMsg) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(timeoutErrorMsg));
        }, ms);

        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
};

export const provisionStore = async (storeData) => {
    const { id: storeId, name, engine } = storeData;

    if (currentProvisioningCount >= MAX_CONCURRENT) {
        const msg = 'Server busy: Max concurrent provisions reached. Please retry later.';
        await eventService.logEvent(storeId, 'WARNING', msg);
        await updateStoreStatus(storeId, 'Failed', msg);
        return;
    }

    currentProvisioningCount++;
    console.log(`[PROVISION] Starting ${storeId} (Concurrent: ${currentProvisioningCount})`);

    try {
        await createNamespace(storeId, name);
        await eventService.logEvent(storeId, 'INFO', 'Namespace created with isolation labels');

        await eventService.logEvent(storeId, 'INFO', `Starting Helm install for ${engine}...`);

        await withTimeout(
            installHelmChart(storeId, engine),
            PROVISION_TIMEOUT_MS,
            'Provisioning timed out after 10 minutes'
        );

        await eventService.logEvent(storeId, 'INFO', 'Helm installation completed');

        // Construct and save the URL
        const domainSuffix = process.env.INGRESS_DOMAIN_SUFFIX || 'local';
        const url = `http://store-${storeId}.${domainSuffix}`;
        await Store.update({ url }, { where: { id: storeId } });

        // We don't mark as Ready yet; the reconciliation loop will check the actual Pod status

    } catch (err) {
        console.error(`[PROVISION] Failed for ${storeId}:`, err);
        await eventService.logEvent(storeId, 'ERROR', `Provisioning failed: ${err.message}`);
        await updateStoreStatus(storeId, 'Failed', err.message);

        // Cleanup on specific failures? For now, we leave it for debugging or manual retry
    } finally {
        currentProvisioningCount--;
    }
};

export const createNamespace = async (storeId, name) => {
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
                    'store-name': name
                }
            }
        };
        await k8sApi.createNamespace({ body: namespace });
    } catch (err) {
        if (err.response && err.response.body.code === 409) {
            console.log(`Namespace ${namespaceName} already exists.`);
            return;
        }
        throw err;
    }
};

const installHelmChart = async (storeId, engine) => {
    const namespace = `store-${storeId}`;
    const releaseName = `store-${storeId}`;
    const chartPath = path.resolve(__dirname, '../../../helm', engine);

    const domainSuffix = process.env.INGRESS_DOMAIN_SUFFIX || 'local';
    const host = `store-${storeId}.${domainSuffix}`;

    let dbPassword, rootPassword, adminPassword;

    try {
        const secret = await k8sApi.readNamespacedSecret('store-secret', namespace);
        const data = secret.body.data;
        if (data && data['db-password']) {
            console.log(`[HELM] Reusing existing DB password for ${storeId}`);
            dbPassword = Buffer.from(data['db-password'], 'base64').toString('utf-8');
        }
        if (data && data['root-password']) {
            rootPassword = Buffer.from(data['root-password'], 'base64').toString('utf-8');
        }
        if (data && data['admin-password']) {
            adminPassword = Buffer.from(data['admin-password'], 'base64').toString('utf-8');
        }
    } catch (err) {
        // Secret not found or other error, ignore and generate new
        // console.log(`[HELM] No existing secret found for ${storeId}, generating new credentials.`);
    }

    if (!dbPassword) dbPassword = crypto.randomBytes(16).toString('hex');
    if (!rootPassword) rootPassword = crypto.randomBytes(16).toString('hex');
    if (!adminPassword) adminPassword = crypto.randomBytes(16).toString('hex');

    return new Promise((resolve, reject) => {
        const command = `helm upgrade --install ${releaseName} ${chartPath} ` +
            `--namespace ${namespace} ` +
            `--set ingress.host=${host} ` +
            `--set mysql.auth.password=${dbPassword} ` +
            `--set mysql.auth.rootPassword=${rootPassword} ` +
            `--set wordpress.adminPassword=${adminPassword} ` +
            `--wait --timeout 15m`;

        console.log(`Executing Helm: ${command}`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Helm error: ${stderr}`);
                reject(error);
                return;
            }
            resolve(true);
        });
    });
};

export const deleteStoreResources = async (storeId) => {
    const namespaceName = `store-${storeId}`;
    const releaseName = `store-${storeId}`;

    await eventService.logEvent(storeId, 'INFO', 'Deleting store resources...');

    // Uninstall Helm Release first
    await eventService.logEvent(storeId, 'INFO', 'Uninstalling Helm release...');
    await new Promise(resolve => {
        exec(`helm uninstall ${releaseName} --namespace ${namespaceName}`, (err, stdout, stderr) => {
            if (err) {
                console.log(`Helm uninstall warning for ${storeId}: ${stderr}`);
            } else {
                console.log(`Helm uninstalled for ${storeId}`);
            }
            resolve(true); // Ignore errors (e.g. not found)
        });
    });
    await eventService.logEvent(storeId, 'INFO', 'Helm release uninstalled');

    // Delete Namespace with timeout
    await eventService.logEvent(storeId, 'INFO', 'Deleting namespace (this may take 30-60 seconds)...');
    try {
        // Add timeout to namespace deletion to prevent indefinite hangs
        await withTimeout(
            k8sApi.deleteNamespace({ name: namespaceName }),
            30000, // 30 seconds timeout
            `Namespace deletion for ${namespaceName} timed out after 30 seconds`
        );
        await eventService.logEvent(storeId, 'INFO', 'Namespace deletion initiated successfully');

        // Note: Namespace deletion is async in K8s, it may continue in background
        console.log(`Namespace ${namespaceName} deletion initiated (may complete in background)`);
    } catch (err) {
        if (err.statusCode === 404) {
            await eventService.logEvent(storeId, 'INFO', 'Namespace already deleted');
        } else if (err.message && err.message.includes('timed out')) {
            await eventService.logEvent(storeId, 'WARNING', 'Namespace deletion initiated but may take time to complete');
            console.warn(`Namespace deletion timeout for ${storeId}, but deletion is likely proceeding in background`);
        } else {
            await eventService.logEvent(storeId, 'ERROR', `Error deleting namespace: ${err.message}`);
            console.error(`Error deleting namespace ${storeId}:`, err);
        }
    }
};

// --- RECONCILIATION LOOP ---
// This is truth: DB says "Provisioning" or "Ready". K8s Says "Pods Running" or "Not".
// We update DB based on K8s reality.

export const reconcileAllStores = async () => {
    try {
        // Fetch all stores from DB
        const stores = await Store.findAll();

        for (const store of stores) {
            if (store.status === 'Failed') continue; // Don't auto-retry failed ones automatically to avoid loops, let user manually retry (delete/create)

            const k8sStatus = await checkK8sStatus(store.id);

            // If DB says Provisioning but K8s says Ready -> Update DB
            if (store.status === 'Provisioning' && k8sStatus === 'Ready') {
                await updateStoreStatus(store.id, 'Ready');
                await eventService.logEvent(store.id, 'SUCCESS', 'Store is now Ready');
            }
            // If DB says Ready but K8s says Not Ready (e.g. crash) -> Update DB?
            // Maybe move back to Provisioning or Unknown?
            else if (store.status === 'Ready' && k8sStatus !== 'Ready') {
                // Maybe it's just restarting. Don't panic too fast.
            }
        }
    } catch (err) {
        console.error('Reconciliation loop error:', err);
    }
};

const checkK8sStatus = async (storeId) => {
    const namespaceName = `store-${storeId}`;
    try {
        // Fix: Client expects object { namespace } for this specific generated client (ObjectAppsV1Api)
        console.log(`DEBUG: Calling listNamespacedDeployment with namespaceName: '${namespaceName}' (type: ${typeof namespaceName})`);

        // Inspect the function we are about to call
        if (k8sAppsApi.listNamespacedDeployment) {
            console.log('DEBUG: k8sAppsApi.listNamespacedDeployment is a function.');
            // console.log('DEBUG: k8sAppsApi.listNamespacedDeployment source:', k8sAppsApi.listNamespacedDeployment.toString().substring(0, 100));
        } else {
            console.error('DEBUG: k8sAppsApi.listNamespacedDeployment is UNDEFINED!');
        }

        // const deployments = await k8sAppsApi.listNamespacedDeployment(namespaceName);
        // const statefulsets = await k8sAppsApi.listNamespacedStatefulSet(namespaceName);
        //         const deployments = await k8sAppsApi.listNamespacedDeployment({ namespace: namespaceName });
        // const statefulsets = await k8sAppsApi.listNamespacedStatefulSet({ namespace: namespaceName });


        //         const all = [...deployments.body.items, ...statefulsets.body.items];
        const deploymentsRes = await k8sAppsApi.listNamespacedDeployment({ namespace: namespaceName });
        const statefulsetsRes = await k8sAppsApi.listNamespacedStatefulSet({ namespace: namespaceName });

        // Handle both response styles
        const deploymentsItems =
            deploymentsRes?.body?.items || deploymentsRes?.items || [];

        const statefulsetsItems =
            statefulsetsRes?.body?.items || statefulsetsRes?.items || [];

        const all = [...deploymentsItems, ...statefulsetsItems];


        if (all.length === 0) return 'Provisioning'; // Likely still creating

        const allReady = all.every(res => {
            const spec = res.spec.replicas || 1;
            const ready = res.status.readyReplicas || 0;
            return ready >= spec;
        });

        return allReady ? 'Ready' : 'Provisioning';
    } catch (err) {
        console.error(`Check status failed for ${storeId}:`, err.message);
        return 'Unknown';
    }
};

