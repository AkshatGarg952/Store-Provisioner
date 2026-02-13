import { KubeConfig, CoreV1Api } from '@kubernetes/client-node';
import crypto from 'crypto';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from '../models/Store.js';
import * as eventService from './eventService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let kc;
let k8sApi;

function getK8sApi() {
    if (!k8sApi) {
        kc = new KubeConfig();
        kc.loadFromDefault();
        k8sApi = kc.makeApiClient(CoreV1Api);
    }
    return k8sApi;
}

let currentProvisioningCount = 0;
const MAX_CONCURRENT = 2;
const PROVISION_TIMEOUT_MS = 900000;

const updateStoreStatus = async (storeId, status, errorReason = null) => {
    try {
        await Store.update({ status, errorReason }, { where: { id: storeId } });
    } catch (err) {
        console.error(`Failed to update store status via DB: ${err}`);
    }
};

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

const parseK8sErrorBody = (err) => {
    if (!err) return null;
    if (err.body && typeof err.body === 'object') return err.body;

    if (typeof err.body === 'string') {
        try {
            return JSON.parse(err.body);
        } catch (_error) {
            return null;
        }
    }

    if (err.response?.body && typeof err.response.body === 'object') {
        return err.response.body;
    }

    if (typeof err.response?.body === 'string') {
        try {
            return JSON.parse(err.response.body);
        } catch (_error) {
            return null;
        }
    }

    return null;
};

const hasStatusCode = (err, statusCode) => {
    const body = parseK8sErrorBody(err);
    return err?.code === statusCode ||
        err?.statusCode === statusCode ||
        err?.response?.statusCode === statusCode ||
        body?.code === statusCode;
};

const isNotFoundError = (err) => {
    const body = parseK8sErrorBody(err);
    return hasStatusCode(err, 404) || body?.reason === 'NotFound';
};

const isAlreadyExistsError = (err) => {
    const body = parseK8sErrorBody(err);
    return hasStatusCode(err, 409) || body?.reason === 'AlreadyExists';
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
    await eventService.logEvent(storeId, 'INFO', `Provisioning worker started (active jobs: ${currentProvisioningCount}/${MAX_CONCURRENT})`);

    try {
        await eventService.logEvent(storeId, 'INFO', 'Creating isolated namespace...');
        const namespaceCreated = await createNamespace(storeId, name);
        if (namespaceCreated) {
            await eventService.logEvent(storeId, 'INFO', 'Namespace created with isolation labels');
        } else {
            await eventService.logEvent(storeId, 'WARNING', 'Namespace already exists, reusing existing namespace');
        }

        await eventService.logEvent(storeId, 'INFO', `Starting Helm install for ${engine}...`);

        await withTimeout(
            installHelmChart(storeId, engine),
            PROVISION_TIMEOUT_MS,
            'Provisioning timed out after 15 minutes'
        );

        await eventService.logEvent(storeId, 'INFO', 'Helm installation completed');

        const domainSuffix = process.env.INGRESS_DOMAIN_SUFFIX || '127.0.0.1.nip.io';
        const url = `http://store-${storeId}.${domainSuffix}`;
        await Store.update({ url }, { where: { id: storeId } });
        await eventService.logEvent(storeId, 'INFO', `Store endpoint assigned: ${url}`);
        await eventService.logEvent(storeId, 'INFO', 'Waiting for Kubernetes pods to become Ready...');

    } catch (err) {
        console.error(`[PROVISION] Failed for ${storeId}:`, err);
        await eventService.logEvent(storeId, 'ERROR', `Provisioning failed: ${err.message}`);
        await updateStoreStatus(storeId, 'Failed', err.message);


    } finally {
        currentProvisioningCount--;
        console.log(`[PROVISION] Finished ${storeId} (Concurrent: ${currentProvisioningCount})`);
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
        await getK8sApi().createNamespace({ body: namespace });
        return true;
    } catch (err) {
        if (isAlreadyExistsError(err)) {
            console.log(`Namespace ${namespaceName} already exists.`);
            return false;
        }
        throw err;
    }
};

const installHelmChart = async (storeId, engine) => {
    const namespace = `store-${storeId}`;
    const releaseName = `store-${storeId}`;
    const chartPath = path.resolve(__dirname, '../../../helm', engine);

    const domainSuffix = process.env.INGRESS_DOMAIN_SUFFIX || '127.0.0.1.nip.io';
    const host = `store-${storeId}.${domainSuffix}`;

    let dbPassword, rootPassword, adminPassword;

    try {
        const secret = await getK8sApi().readNamespacedSecret('store-secret', namespace);
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

    await eventService.logEvent(storeId, 'INFO', 'Uninstalling Helm release...');
    const helmResult = await new Promise(resolve => {
        exec(`helm uninstall ${releaseName} --namespace ${namespaceName}`, (err, stdout, stderr) => {
            if (err) {
                console.log(`Helm uninstall warning for ${storeId}: ${stderr}`);
                if (typeof stderr === 'string' && stderr.toLowerCase().includes('release: not found')) {
                    resolve('not-found');
                    return;
                }
                resolve('warning');
            } else {
                console.log(`Helm uninstalled for ${storeId}`);
                resolve('uninstalled');
            }
        });
    });

    if (helmResult === 'uninstalled') {
        await eventService.logEvent(storeId, 'INFO', 'Helm release uninstalled');
    } else if (helmResult === 'not-found') {
        await eventService.logEvent(storeId, 'INFO', 'Helm release already removed');
    } else {
        await eventService.logEvent(storeId, 'WARNING', 'Helm uninstall returned warning; continuing cleanup');
    }

    await eventService.logEvent(storeId, 'INFO', 'Deleting namespace (this may take 30-60 seconds)...');
    try {
        await withTimeout(
            getK8sApi().deleteNamespace({ name: namespaceName }),
            30000,
            `Namespace deletion for ${namespaceName} timed out after 30 seconds`
        );
        await eventService.logEvent(storeId, 'INFO', 'Namespace deletion initiated successfully');


        console.log(`Namespace ${namespaceName} deletion initiated (may complete in background)`);
    } catch (err) {
        if (isNotFoundError(err)) {
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

export const reconcileAllStores = async () => {
    try {
        const stores = await Store.findAll();

        for (const store of stores) {
            if (store.status === 'Failed') continue;

            const k8sStatus = await checkK8sStatus(store.id);

            if (store.status === 'Provisioning' && k8sStatus === 'Ready') {
                await updateStoreStatus(store.id, 'Ready');
                await eventService.logEvent(store.id, 'SUCCESS', 'Store is now Ready');
            }
        }
    } catch (err) {
        console.error('Reconciliation loop error:', err);
    }
};

const checkK8sStatus = async (storeId) => {
    const namespaceName = `store-${storeId}`;
    try {
        const podsRes = await getK8sApi().listNamespacedPod({ namespace: namespaceName });
        const pods = podsRes?.body?.items || podsRes?.items || [];

        if (pods.length === 0) return 'Provisioning';

        const allReady = pods.every(pod => {
            const running = pod?.status?.phase === 'Running';
            const statuses = pod?.status?.containerStatuses || [];
            const containersReady =
                statuses.length > 0 && statuses.every(container => container.ready);
            return running && containersReady;
        });

        return allReady ? 'Ready' : 'Provisioning';
    } catch (err) {
        console.error(`Check status failed for ${storeId}:`, err.message);
        return 'Unknown';
    }
};

