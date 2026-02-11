import { KubeConfig, AppsV1Api, CoreV1Api } from '@kubernetes/client-node';

const kc = new KubeConfig();
kc.loadFromDefault();
const k8sAppsApi = kc.makeApiClient(AppsV1Api);
const k8sApi = kc.makeApiClient(CoreV1Api);

const namespace = 'store-099a5c93'; // Using the known existing namespace

async function testCurrentSyntax() {
    console.log('Testing current syntax: listNamespacedDeployment({ namespace: ... })');
    try {
        const res = await k8sAppsApi.listNamespacedDeployment({ namespace });
        console.log('Current syntax (Deployment) SUCCESS');
        console.log('Response keys:', Object.keys(res));
        if (res.body) console.log('Response body keys:', Object.keys(res.body));
        if (res.items) {
            console.log('Direct items length:', res.items.length);
            res.items.forEach((item, index) => {
                const name = item.metadata.name;
                const spec = item.spec.replicas || 1;
                const ready = item.status.readyReplicas || 0;
                console.log(`Deployment ${index + 1} (${name}): Replicas: ${spec}, Ready: ${ready}`);
                if (ready < spec) {
                    console.log(`  Status Conditions:`, JSON.stringify(item.status.conditions, null, 2));
                }
            });
        }

        // List Pods to debug
        console.log('\nListing Pods:');
        const podRes = await k8sApi.listNamespacedPod({ namespace });
        console.log('Pod response keys:', Object.keys(podRes));
        const pods = podRes.body ? podRes.body.items : podRes.items;

        if (pods) {
            console.log(`Found ${pods.length} pods.`);
            pods.forEach(pod => {
                console.log(`Pod: ${pod.metadata.name}`);
                console.log(`  Phase: ${pod.status.phase}`);
                if (pod.status.conditions) console.log(`  Conditions:`, JSON.stringify(pod.status.conditions, null, 2));
                if (pod.status.containerStatuses) console.log(`  Container Statuses:`, JSON.stringify(pod.status.containerStatuses, null, 2));
            });
        } else {
            console.log('No pods found or invalid response format.');
        }

        const res2 = await k8sAppsApi.listNamespacedStatefulSet({ namespace });
        console.log('Current syntax (StatefulSet) SUCCESS');
        console.log('StatefulSet response keys:', Object.keys(res2));
        if (res2.items) console.log('StatefulSet items length:', res2.items.length);

        console.log('Testing undefined namespace');
        try {
            await k8sAppsApi.listNamespacedDeployment({ namespace: undefined });
            console.log('Undefined namespace SUCCESS (Unexpected)');
        } catch (err) {
            console.log('Undefined namespace FAILED:', err.message);
        }
        console.log('Testing non-existent namespace');
        try {
            const res3 = await k8sAppsApi.listNamespacedDeployment({ namespace: 'non-existent-namespace-123' });
            console.log('Non-existent namespace SUCCESS');
            console.log('Result type:', typeof res3);
            if (res3 && res3.items) console.log('Items length:', res3.items.length);
        } catch (err) {
            console.log('Non-existent namespace FAILED:', err.message);
        }

    } catch (err) {
        console.log('Current syntax FAILED (Expected)');
        console.log('Error message:', err.message);
        console.log(`Full Error: ${JSON.stringify(err, null, 2)}`);
        if (err.body) console.log('Error body:', err.body);
    }
}

async function testCorrectSyntax() {
    console.log('\nTesting correct syntax: listNamespacedDeployment(namespace)');
    try {
        // This is what it matches typical k8s client usage
        const res = await k8sAppsApi.listNamespacedDeployment(namespace);
        console.log(`Correct syntax (Deployment) SUCCESS. Found ${res.body.items.length} deployments.`);

        const res2 = await k8sAppsApi.listNamespacedStatefulSet(namespace);
        console.log(`Correct syntax (StatefulSet) SUCCESS. Found ${res2.body.items.length} statefulsets.`);
    } catch (err) {
        console.log('Correct syntax FAILED');
        console.log(err.toString());
        console.log(JSON.stringify(err, null, 2));
    }
}

(async () => {
    await testCurrentSyntax();
    await testCorrectSyntax();
})();
