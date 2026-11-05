import jwt from 'jsonwebtoken';
import { mysqlPool } from '../config/mysql.js';

export function verifyAccessToken(token, secret = process.env.JWT_SECRET) {
    const claims = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (!Number.isInteger(Number(claims.userId)) || Number(claims.userId) <= 0) throw new Error('Invalid token subject');
    return claims;
}

export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Authentication token required'
        });
    }

    let claims;
    try {
        claims = verifyAccessToken(authHeader.split(' ')[1]);
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
    try {
        const [rows] = await mysqlPool.execute('SELECT User_ID,Name,Email,Role FROM `User` WHERE User_ID=? LIMIT 1', [claims.userId]);
        if (!rows[0]) return res.status(401).json({ message: 'Invalid or expired token' });
        req.user = { userId: Number(rows[0].User_ID), name: rows[0].Name, email: rows[0].Email, role: rows[0].Role };
        next();
    } catch (error) {
        next(error);
    }
}

export function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }
        next();
    };
}
