import sequelize from './sequelize.js';
import Store from '../models/Store.js';
import StoreEvent from '../models/StoreEvent.js';

export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection established.');

        await sequelize.sync({ alter: true });
        console.log('Database synced.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};
