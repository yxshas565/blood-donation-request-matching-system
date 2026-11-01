import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mysqlPool } from '../config/mysql.js';
import { dateOnly } from '../services/dates.js';

const allowedRoles = ['Donor', 'Hospital', 'Organization'];

function generateToken(user) {
    return jwt.sign(
        {
            userId: user.User_ID,
            name: user.Name,
            email: user.Email,
            role: user.Role
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d', algorithm: 'HS256' }
    );
}

export async function register(req, res, next) {
    const {
        name, email, phone, password, role,
        bloodGroupId, dateOfBirth, gender,
        hospitalName, organizationName,
        address, organizationType
    } = req.body;

    if (typeof name !== 'string' || !name.trim() || !email || !password || !role) {
        return res.status(400).json({
            message: 'Name, email, password and role are required'
        });
    }

    if (!allowedRoles.includes(role)) {
        return res.status(400).json({
            message: 'Invalid registration role'
        });
    }

    if (String(password).length < 8 || String(password).length > 128) {
        return res.status(400).json({
            message: 'Password must contain at least 8 characters'
        });
    }

    if (role === 'Donor' && (!bloodGroupId || !dateOfBirth || !gender)) {
        return res.status(400).json({
            message: 'Donor registration requires blood group, date of birth and gender'
        });
    }

    if (role === 'Hospital' && !hospitalName) {
        return res.status(400).json({
            message: 'Hospital name is required'
        });
    }

    if (role === 'Organization' && !organizationName) {
        return res.status(400).json({
            message: 'Organization name is required'
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    let canonicalBirthDate;
    if (role === 'Donor') {
        try { canonicalBirthDate = dateOnly(dateOfBirth); }
        catch { return res.status(400).json({ message: 'Date of birth must be a valid YYYY-MM-DD date' }); }
        if (!['Male', 'Female', 'Other'].includes(gender)) return res.status(400).json({ message: 'Invalid gender' });
        if (!Number.isInteger(Number(bloodGroupId))) return res.status(400).json({ message: 'Invalid blood group ID' });
    }
    if (typeof phone === 'string' && phone.length > 40) return res.status(400).json({ message: 'Phone number is too long' });
    if (typeof name !== 'string' || name.trim().length > 120) return res.status(400).json({ message: 'Name is too long' });
    const passwordHash = await bcrypt.hash(String(password), 12);
    const connection = await mysqlPool.getConnection();

    try {
        await connection.beginTransaction();

        const [existing] = await connection.execute(
            'SELECT User_ID FROM `User` WHERE Email = ? LIMIT 1',
            [normalizedEmail]
        );

        if (existing.length) {
            await connection.rollback();
            return res.status(409).json({
                message: 'An account with this email already exists'
            });
        }

        const [userResult] = await connection.execute(
            `INSERT INTO \`User\`
             (Name, Email, Phone, Password, Role)
             VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), normalizedEmail, phone || null, passwordHash, role]
        );

        const userId = userResult.insertId;

        if (role === 'Donor') {
            const [groups] = await connection.execute(
                'SELECT BloodGroup_ID FROM BloodGroup WHERE BloodGroup_ID = ?',
                [Number(bloodGroupId)]
            );

            if (!groups.length) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Invalid blood group ID'
                });
            }

            await connection.execute(
                `INSERT INTO Donor
                 (User_ID, BloodGroup_ID, Date_of_Birth, Gender, Availability_Status)
                 VALUES (?, ?, ?, ?, TRUE)`,
                [userId, Number(bloodGroupId), canonicalBirthDate, gender]
            );
        }

        if (role === 'Hospital') {
            const [existingHospital] = await connection.execute(
                'SELECT Hospital_ID,User_ID FROM Hospital WHERE Email=? LIMIT 2 FOR UPDATE', [normalizedEmail]
            );
            if (existingHospital.length > 1 || (existingHospital[0]?.User_ID && Number(existingHospital[0].User_ID) !== Number(userId))) {
                await connection.rollback();
                return res.status(409).json({ message: 'Hospital profile is already associated with another account' });
            }
            if (existingHospital[0]) await connection.execute(
                'UPDATE Hospital SET User_ID=? WHERE Hospital_ID=? AND User_ID IS NULL', [userId, existingHospital[0].Hospital_ID]
            );
            else await connection.execute(
                `INSERT INTO Hospital (Hospital_Name,Address,Phone,Email,User_ID) VALUES (?,?,?,?,?)`,
                [hospitalName.trim(), address || null, phone || null, normalizedEmail, userId]
            );
        }

        if (role === 'Organization') {
            const [existingOrganization] = await connection.execute(
                'SELECT Organization_ID,User_ID FROM Organization WHERE Email=? LIMIT 2 FOR UPDATE', [normalizedEmail]
            );
            if (existingOrganization.length > 1 || (existingOrganization[0]?.User_ID && Number(existingOrganization[0].User_ID) !== Number(userId))) {
                await connection.rollback();
                return res.status(409).json({ message: 'Organization profile is already associated with another account' });
            }
            if (existingOrganization[0]) await connection.execute(
                'UPDATE Organization SET User_ID=? WHERE Organization_ID=? AND User_ID IS NULL', [userId, existingOrganization[0].Organization_ID]
            );
            else await connection.execute(
                `INSERT INTO Organization (Organization_Name,Address,Phone,Email,Organization_Type,User_ID) VALUES (?,?,?,?,?,?)`,
                [organizationName.trim(), address || null, phone || null, normalizedEmail, organizationType || null, userId]
            );
        }

        await connection.commit();

        const user = {
            User_ID: userId,
            Name: name.trim(),
            Email: normalizedEmail,
            Role: role
        };

        res.status(201).json({
            message: 'Registration successful',
            user,
            token: generateToken(user)
        });

    } catch (error) {
        await connection.rollback();

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'An account with these details already exists'
            });
        }

        next(error);
    } finally {
        connection.release();
    }
}

export async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        const [rows] = await mysqlPool.execute(
            `SELECT User_ID, Name, Email, Password, Role
             FROM \`User\`
             WHERE Email = ?
             LIMIT 1`,
            [String(email).trim().toLowerCase()]
        );

        if (!rows.length) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const user = rows[0];

        const validPassword =
            typeof user.Password === 'string' && user.Password.startsWith('$2') &&
            await bcrypt.compare(String(password), user.Password);

        if (!validPassword) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const safeUser = {
            User_ID: user.User_ID,
            Name: user.Name,
            Email: user.Email,
            Role: user.Role
        };

        res.json({
            message: 'Login successful',
            user: safeUser,
            token: generateToken(user)
        });

    } catch (error) {
        next(error);
    }
}

export async function getProfile(req, res, next) {
    try {
        const [rows] = await mysqlPool.execute(
            `SELECT User_ID, Name, Email, Phone, Role
             FROM \`User\`
             WHERE User_ID = ?`,
            [req.user.userId]
        );

        if (!rows.length) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        res.json({
            user: rows[0]
        });

    } catch (error) {
        next(error);
    }
}
