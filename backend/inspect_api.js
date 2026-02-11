import { AppsV1Api } from '@kubernetes/client-node';

console.log('Inspecting AppsV1Api.listNamespacedDeployment signature:');
const method = AppsV1Api.prototype.listNamespacedDeployment;
if (method) {
    console.log('Method found.');
    console.log('Length (num args):', method.length);
    console.log('Source (first 100 chars):', method.toString().substring(0, 100));
} else {
    console.log('Method NOT found on prototype.');
}
