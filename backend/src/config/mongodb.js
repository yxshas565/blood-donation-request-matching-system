import { MongoClient } from 'mongodb';

let client;
let database;
let connecting;

function newClient() {
    return new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000 });
}

export async function connectMongoDB() {
    if (database) return database;
    if (connecting) return connecting;
    connecting = (async () => {
        client = newClient();
        try {
            await client.connect();
            const nextDatabase = client.db(process.env.MONGODB_DATABASE || 'BloodDonationDB');
            await nextDatabase.command({ ping: 1 });
            await ensureMongoIndexes(nextDatabase);
            database = nextDatabase;
            return database;
        } catch (error) {
            await client.close().catch(() => {});
            client = undefined;
            database = undefined;
            throw error;
        }
    })();
    try { return await connecting; }
    finally { connecting = undefined; }
}

export async function ensureMongoIndexes(db = getMongoDB()) {
    await Promise.all([
        db.collection('DonorLocation').createIndex({ location: '2dsphere' }, { name: 'location_2dsphere' }),
        db.collection('DonorLocation').createIndex({ donor_id: 1 }, { unique: true, name: 'donor_id_1' }),
        db.collection('DonationHistory').createIndex({ mysql_donation_id: 1 }, { unique: true, name: 'mysql_donation_id_1' }),
        db.collection('DonationHistory').createIndex({ donor_id: 1, donation_date: -1 }, { name: 'donor_id_1_donation_date_-1' }),
        db.collection('Notifications').createIndex({ recipient_user_id: 1, is_read: 1, created_at: -1 }, { name: 'recipient_user_id_1_is_read_1_created_at_-1' }),
        db.collection('Notifications').createIndex({ related_request_id: 1 }, { name: 'related_request_id_1' }),
        db.collection('Notifications').createIndex({ dedupe_key: 1 }, { unique: true, sparse: true, name: 'dedupe_key_1' })
    ]);
}

export function getMongoDB() {
    if (!database) {
        throw new Error('MongoDB is not connected');
    }
    return database;
}

export function isMongoDBConnected() {
    return Boolean(database);
}

export async function closeMongoDB() {
    database = undefined;
    if (client) await client.close();
    client = undefined;
}
