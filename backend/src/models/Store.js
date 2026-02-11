import { DataTypes } from 'sequelize';
import sequelize from '../db/sequelize.js';

const Store = sequelize.define('Store', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    engine: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING, // Provisioning, Ready, Failed
        defaultValue: 'Provisioning',
    },
    errorReason: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    url: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
    }
}, {
    timestamps: true,
});

export default Store;
