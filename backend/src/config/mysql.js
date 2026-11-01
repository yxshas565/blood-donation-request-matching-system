import mysql from 'mysql2/promise';

export const mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'BloodDonationDB',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
});

export async function testMySQL() {
    const [rows] = await mysqlPool.query(
        'SELECT DATABASE() AS db_name, VERSION() AS mysql_version'
    );

    return rows[0];
}
