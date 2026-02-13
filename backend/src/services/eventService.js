import StoreEvent from '../models/StoreEvent.js';

export const logEvent = async (storeId, type, message) => {
    try {
        await StoreEvent.create({
            storeId,
            type,
            message
        });
        console.log(`[EVENT][${storeId}] ${type}: ${message}`);
    } catch (error) {
        console.error('Failed to log event:', error);
    }
};

export const getStoreEvents = async (storeId, limit = 100) => {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100;

    return await StoreEvent.findAll({
        where: { storeId },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: safeLimit
    });
};

export const getEvents = getStoreEvents;
