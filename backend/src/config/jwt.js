import crypto from 'crypto';

export const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    }
    return process.env.JWT_SECRET;
};
