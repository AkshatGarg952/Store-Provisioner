import { v4 as uuidv4 } from "uuid";
import * as k8sService from '../services/kubernetesService.js';

export const getAllStores = async (req, res) => {
    try {
        const stores = await k8sService.listStores();
        res.json(stores);
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ error: 'Failed to fetch stores' });
    }
};

export const getStore = async (req, res) => {
    try {
        const store = await k8sService.getStore(req.params.id);
        if (!store) return res.status(404).json({ error: 'Store not found' });
        res.json(store);
    } catch (error) {
        console.error('Error fetching store:', error);
        res.status(500).json({ error: 'Failed to fetch store' });
    }
};

export const createStore = async (req, res) => {
    try {
        const { name, engine } = req.body;
        if (!name) return res.status(404).json({ error: 'Store name is required' });

        const storeId = uuidv4().substring(0, 8);

        // I'm keeping this synchronous to make sure the namespace (the 'record') definitely exists 
        // before we return success. We can push the heavy Helm stuff to the background later.
        const newStore = await k8sService.createStore(storeId, name, engine);

        // Add engine to the store object so the background process knows what to install
        newStore.engine = engine;

        res.status(201).json(newStore);

        // kick off robust provisioning
        // We don't await this because the reconciliation loop will catch it if it fails/crashes
        k8sService.ensureHelmRelease(newStore.id, newStore.engine).catch(err => {
            console.error(`Initial provisioning trigger failed for ${storeId}:`, err);
        });

    } catch (error) {
        console.error('Error creating store:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteStore = async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await k8sService.deleteStore(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Store does not exist' });
        }
        res.json({ message: `Store ${id} deleted` });
    } catch (error) {
        console.error(`Failed to delete store ${id}:`, error);
        res.status(500).json({ error: 'Failed to delete store' });
    }
};