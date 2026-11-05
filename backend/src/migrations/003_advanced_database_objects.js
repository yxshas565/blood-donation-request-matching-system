export const id = '003_advanced_database_objects';

async function indexExists(db, table, index) {
  const [rows] = await db.execute(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1`,
    [table, index]
  );
  return rows.length > 0;
}

async function ensureIndex(db, table, index, columns) {
  if (!(await indexExists(db, table, index))) {
    await db.query(`CREATE INDEX \`${index}\` ON \`${table}\` (${columns})`);
  }
}

export async function up(db) {
  await ensureIndex(db, 'Donor', 'idx_donor_availability_bloodgroup',
    'Availability_Status, BloodGroup_ID');
  await ensureIndex(db, 'Donation', 'idx_donation_donor_status_date',
    'Donor_ID, Donation_Status, Donation_Date');
  await ensureIndex(db, 'BloodRequest', 'idx_request_status_urgency_date',
    'Request_Status, Urgency, Request_Date');
  await ensureIndex(db, 'BloodInventory', 'idx_inventory_hospital_group',
    'Hospital_ID, BloodGroup_ID');

  await db.query(`
    CREATE OR REPLACE VIEW vw_availabledonors AS
    SELECT
      d.Donor_ID,
      d.User_ID,
      u.Name,
      u.Phone,
      d.BloodGroup_ID,
      b.Blood_Type,
      b.Rh_Factor,
      CONCAT(b.Blood_Type, b.Rh_Factor) AS Blood_Group,
      d.Availability_Status,
      d.Last_Donation_Date
    FROM Donor d
    JOIN BloodGroup b ON b.BloodGroup_ID=d.BloodGroup_ID
    JOIN \`User\` u ON u.User_ID=d.User_ID
    WHERE d.Availability_Status=1
  `);

  await db.query(`
    CREATE OR REPLACE VIEW vw_hospitalinventorysummary AS
    SELECT
      h.Hospital_ID,
      h.Hospital_Name,
      COUNT(bi.Inventory_ID) AS Blood_Groups_Tracked,
      COALESCE(SUM(bi.Quantity_Available), 0) AS Total_Units_Available,
      COALESCE(SUM(CASE WHEN bi.Quantity_Available > 0 THEN 1 ELSE 0 END), 0)
        AS Blood_Groups_In_Stock,
      MAX(bi.Last_Updated) AS Last_Updated
    FROM Hospital h
    LEFT JOIN BloodInventory bi ON bi.Hospital_ID=h.Hospital_ID
    GROUP BY h.Hospital_ID, h.Hospital_Name
  `);

  await db.query(`
    CREATE OR REPLACE VIEW vw_pendingbloodrequests AS
    SELECT
      br.Request_ID,
      br.Hospital_ID,
      h.Hospital_Name,
      br.Organization_ID,
      o.Organization_Name,
      br.BloodGroup_ID,
      bg.Blood_Type,
      bg.Rh_Factor,
      CONCAT(bg.Blood_Type, bg.Rh_Factor) AS Required_Blood_Group,
      br.Quantity_Required,
      br.Request_Date,
      br.Urgency,
      br.Request_Status
    FROM BloodRequest br
    LEFT JOIN Hospital h ON h.Hospital_ID=br.Hospital_ID
    LEFT JOIN Organization o ON o.Organization_ID=br.Organization_ID
    JOIN BloodGroup bg ON bg.BloodGroup_ID=br.BloodGroup_ID
    WHERE br.Request_Status IN ('Pending', 'Partially_Fulfilled')
  `);

  await db.query('DROP PROCEDURE IF EXISTS sp_FindCompatibleDonors');

  await db.query(`
    CREATE PROCEDURE sp_FindCompatibleDonors(IN p_RecipientBloodGroupID INT)
    BEGIN
      DECLARE v_recipient_type VARCHAR(2) DEFAULT NULL;
      DECLARE v_recipient_rh CHAR(1) DEFAULT NULL;

      SELECT Blood_Type, Rh_Factor
        INTO v_recipient_type, v_recipient_rh
        FROM BloodGroup
       WHERE BloodGroup_ID=p_RecipientBloodGroupID
       LIMIT 1;

      IF v_recipient_type IS NULL OR v_recipient_rh IS NULL THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT='Invalid recipient blood group';
      END IF;

      SELECT
        d.Donor_ID,
        d.User_ID,
        d.Availability_Status,
        d.Last_Donation_Date,
        b.Blood_Type,
        b.Rh_Factor,
        u.Name,
        u.Phone
      FROM Donor d
      JOIN BloodGroup b ON b.BloodGroup_ID=d.BloodGroup_ID
      JOIN \`User\` u ON u.User_ID=d.User_ID
      WHERE d.Availability_Status=1
        AND (
          b.Blood_Type='O'
          OR (b.Blood_Type='A' AND v_recipient_type IN ('A', 'AB'))
          OR (b.Blood_Type='B' AND v_recipient_type IN ('B', 'AB'))
          OR (b.Blood_Type='AB' AND v_recipient_type='AB')
        )
        AND (v_recipient_rh='+' OR b.Rh_Factor='-')
      ORDER BY d.Last_Donation_Date IS NOT NULL, d.Last_Donation_Date ASC;
    END
  `);

  await db.query('DROP FUNCTION IF EXISTS fn_ApprovedDonationCount');

  await db.query(`
    CREATE FUNCTION fn_ApprovedDonationCount(p_DonorID INT)
    RETURNS INT
    NOT DETERMINISTIC
    READS SQL DATA
    BEGIN
      DECLARE v_count INT DEFAULT 0;

      SELECT COUNT(*)
        INTO v_count
        FROM Donation
       WHERE Donor_ID=p_DonorID
         AND Donation_Status='Approved';

      RETURN v_count;
    END
  `);
}

