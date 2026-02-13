import { DataTypes } from 'sequelize';
import sequelize from '../db/sequelize.js';

const StoreEvent = sequelize.define('StoreEvent', {
    storeId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.STRING,
        defaultValue: 'INFO',
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
}, {
    timestamps: true,
});

export default StoreEvent;
