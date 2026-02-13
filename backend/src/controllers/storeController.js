import crypto from 'crypto';
import Store from '../models/Store.js';
import * as k8sService from '../services/kubernetesService.js';
import * as eventService from '../services/eventService.js';

// Get all stores for the authenticated user
export const getAllStores = async (req, res) => {
    try {
        const stores = await Store.findAll({
            where: { userId: req.user.id }
        });
        res.json(stores);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get a specific store (ensure ownership)
export const getStore = async (req, res) => {
    try {
        const store = await Store.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json(store);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create a new store
export const createStore = async (req, res) => {
    try {
        const { name, engine } = req.body;
        const userId = req.user.id;

        const count = await Store.count({ where: { userId } });
        if (count >= 3) {
            return res.status(403).json({ error: "You have reached your limit of 3 stores." });
        }

        const storeId = crypto.randomUUID().split('-')[0];

        const newStore = await Store.create({
            id: storeId,
            name,
            engine,
            userId,
            status: 'Provisioning'
        });

        await eventService.logEvent(storeId, 'INFO', `Store creation initiated for ${name} using ${engine}`);

        // Return immediately, provisioning runs async
        res.status(201).json(newStore);

        k8sService.provisionStore(newStore.toJSON()).catch(err => {
            console.error(`Provisioning trigger failed for ${storeId}:`, err);
        });

    } catch (err) {
        console.error("Create Store Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// Delete a store
export const deleteStore = async (req, res) => {
    try {
        const store = await Store.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }



        await k8sService.deleteStoreResources(store.id);


        await store.destroy();

        res.json({ message: 'Store deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getStoreEvents = async (req, res) => {
    try {

        const store = await Store.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isInteger(parsedLimit) ? parsedLimit : 100;

        const events = await eventService.getStoreEvents(req.params.id, limit);
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
