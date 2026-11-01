import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { mysqlPool } from '../config/mysql.js';
import { validateEnv } from '../config/validateEnv.js';
import { dateOnly, toMongoDate } from '../services/dates.js';

const applyChanges = process.argv.includes('--apply');

function snapshot(row) {
  return {
    mysql_donation_id: Number(row.Donation_ID),
    donor_id: Number(row.Donor_ID),
    blood_group: `${row.Blood_Type}${row.Rh_Factor}`,
    donation_date: toMongoDate(dateOnly(row.Donation_Date)),
    quantity: Number(row.Quantity),
    donation_status: row.Donation_Status,
    receiving_hospital_id: row.Hospital_ID === null ? null : Number(row.Hospital_ID)
  };
}

function safeDate(value) {
  try { return dateOnly(value); } catch { return null; }
}

function compare(sql, mongo) {
  const fields = [];
  if (Number(mongo.donor_id) !== Number(sql.Donor_ID)) fields.push('donor_id');
  if (`${sql.Blood_Type}${sql.Rh_Factor}` !== mongo.blood_group) fields.push('blood_group');
  if (dateOnly(sql.Donation_Date) !== safeDate(mongo.donation_date)) fields.push('donation_date');
  if (Number(sql.Quantity) !== Number(mongo.quantity)) fields.push('quantity');
  if (sql.Donation_Status !== mongo.donation_status) fields.push('donation_status');
  const sqlHospital = sql.Hospital_ID === null ? null : Number(sql.Hospital_ID);
  const mongoHospital = mongo.receiving_hospital_id === null || mongo.receiving_hospital_id === undefined ? null : Number(mongo.receiving_hospital_id);
  if (sqlHospital !== mongoHospital) fields.push('receiving_hospital_id');
  return fields;
}

async function main() {
  validateEnv();
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE);
    const [sqlRows] = await mysqlPool.query(
      `SELECT d.Donation_ID,d.Donor_ID,d.Hospital_ID,d.Donation_Date,d.Quantity,d.Donation_Status,b.Blood_Type,b.Rh_Factor
         FROM Donation d JOIN BloodGroup b USING(BloodGroup_ID) ORDER BY d.Donation_ID`
    );
    const docs = await db.collection('DonationHistory').find({}, {
      projection: { _id: 1, mysql_donation_id: 1, donor_id: 1, blood_group: 1, donation_date: 1, quantity: 1, donation_status: 1, receiving_hospital_id: 1 }
    }).toArray();
    const docsById = new Map();
    for (const doc of docs) {
      const id = Number(doc.mysql_donation_id);
      docsById.set(id, [...(docsById.get(id) || []), doc]);
    }
    const sqlIds = new Set(sqlRows.map(row => Number(row.Donation_ID)));
    const duplicates = [...docsById.entries()].filter(([, entries]) => entries.length > 1)
      .map(([id, entries]) => ({ mysqlDonationId: id, count: entries.length }));
    const orphaned = docs.filter(doc => !sqlIds.has(Number(doc.mysql_donation_id)))
      .map(doc => ({ mongoId: String(doc._id), mysqlDonationId: doc.mysql_donation_id }));
    const missing = [];
    const mismatched = [];
    for (const row of sqlRows) {
      const id = Number(row.Donation_ID);
      const matchingDocs = docsById.get(id) || [];
      if (!matchingDocs.length) missing.push({ mysqlDonationId: id });
      else if (matchingDocs.length === 1) {
        const fields = compare(row, matchingDocs[0]);
        if (fields.length) mismatched.push({ mysqlDonationId: id, fields, mysqlDate: dateOnly(row.Donation_Date), mongoDate: safeDate(matchingDocs[0].donation_date), mongoBsonType: matchingDocs[0].donation_date instanceof Date ? 'date' : typeof matchingDocs[0].donation_date });
      }
    }
    const report = { mode: applyChanges ? 'apply' : 'dry-run', mysqlDonations: sqlRows.length, mongoDocuments: docs.length, missing, duplicates, orphaned, mismatched };
    if (applyChanges) {
      let corrected = 0;
      for (const row of sqlRows) {
        const id = Number(row.Donation_ID);
        const matchingDocs = docsById.get(id) || [];
        if (matchingDocs.length > 1) continue;
        await db.collection('DonationHistory').updateOne(
          { mysql_donation_id: id },
          { $set: snapshot(row) },
          { upsert: matchingDocs.length === 0 }
        );
        if (matchingDocs.length === 0 || compare(row, matchingDocs[0]).length) corrected += 1;
      }
      report.correctedOrCreated = corrected;
      report.orphanDocumentsDeleted = 0;
    }
    console.log(JSON.stringify(report, null, 2));
    if (duplicates.length) process.exitCode = 2;
  } finally {
    await client.close().catch(() => {});
    await mysqlPool.end();
  }
}

main().catch(error => {
  console.error(`Reconciliation failed: ${error.code || error.name || 'Error'}`);
  process.exitCode = 1;
});
