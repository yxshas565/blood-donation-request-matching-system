export const id = '002_drop_legacy_donation_trigger';

export async function up(db) {
  const [rows] = await db.execute(
    'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?',
    ['trg_UpdateLastDonation']
  );
  if (rows.length) await db.query('DROP TRIGGER `trg_UpdateLastDonation`');
  await db.query(`UPDATE Donor d
    LEFT JOIN (SELECT Donor_ID,MAX(Donation_Date) AS Last_Approved
               FROM Donation WHERE Donation_Status='Approved' GROUP BY Donor_ID) latest
      ON latest.Donor_ID=d.Donor_ID
    SET d.Last_Donation_Date=latest.Last_Approved`);
}
