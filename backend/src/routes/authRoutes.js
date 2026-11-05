import { Router } from 'express';
import { body, validationResult } from 'express-validator';

import {
    register,
    login,
    getProfile
} from '../controllers/authController.js';

import { requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const router = Router();
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Try again later.' });
const registrationLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: Number(process.env.REGISTRATION_RATE_LIMIT_MAX || 5), message: 'Too many registration attempts. Try again later.' });

const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    next();
};

router.post(
    '/register',
    registrationLimiter,
    [
        body('name').isString().trim().notEmpty().isLength({ max: 120 }),
        body('email').isEmail().normalizeEmail(),
        body('password').isString().isLength({ min: 8, max: 128 }),
        body('role').isIn(['Donor', 'Hospital', 'Organization']),
        body('phone').optional({ nullable: true }).isString().isLength({ max: 40 }),
        body('address').optional({ nullable: true }).isString().isLength({ max: 250 }),
        body('bloodGroupId').if((_value, { req }) => req.body.role === 'Donor').isInt({ min: 1 }),
        body('dateOfBirth').if((_value, { req }) => req.body.role === 'Donor').isISO8601({ strict: true, strictSeparator: true }),
        body('gender').if((_value, { req }) => req.body.role === 'Donor').isIn(['Male', 'Female', 'Other']),
        body('hospitalName').if((_value, { req }) => req.body.role === 'Hospital').isString().trim().notEmpty().isLength({ max: 150 }),
        body('organizationName').if((_value, { req }) => req.body.role === 'Organization').isString().trim().notEmpty().isLength({ max: 150 })
    ],
    validate,
    register
);

router.post(
    '/login',
    loginLimiter,
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isString().notEmpty().isLength({ max: 128 })
    ],
    validate,
    login
);

router.get('/me', requireAuth, getProfile);

export default router;
