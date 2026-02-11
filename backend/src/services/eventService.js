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
        // Log to console if DB fails, don't crash the app
        console.error('Failed to log event:', error);
    }
};

export const getStoreEvents = async (storeId) => {
    return await StoreEvent.findAll({
        where: { storeId },
        order: [['createdAt', 'DESC']]
    });
};
