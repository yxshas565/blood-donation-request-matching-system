export const id = '001_integrations';

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(db, table, index) {
  const [rows] = await db.execute(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1',
    [table, index]
  );
  return rows.length > 0;
}

async function foreignKeyExists(db, table, constraint) {
  const [rows] = await db.execute(
    'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=? AND CONSTRAINT_TYPE=\'FOREIGN KEY\'',
    [table, constraint]
  );
  return rows.length > 0;
}

async function addOwnership(db, table, role, constraint, index) {
  if (!(await columnExists(db, table, 'User_ID'))) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN User_ID INT NULL`);
  }
  await db.query(
    `UPDATE \`${table}\` AS entity
       JOIN \`User\` AS account
         ON LOWER(TRIM(account.Email))=LOWER(TRIM(entity.Email)) AND account.Role=?
       SET entity.User_ID=account.User_ID
     WHERE entity.User_ID IS NULL
       AND (SELECT COUNT(*) FROM \`User\` AS candidate
            WHERE LOWER(TRIM(candidate.Email))=LOWER(TRIM(entity.Email)) AND candidate.Role=?)=1`,
    [role, role]
  );
  if (!(await indexExists(db, table, index))) {
    await db.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${index}\` (User_ID)`);
  }
  if (!(await foreignKeyExists(db, table, constraint))) {
    await db.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraint}\` FOREIGN KEY (User_ID) REFERENCES \`User\` (User_ID) ON DELETE SET NULL`);
  }
}

async function createTrigger(db, name, sql) {
  const [rows] = await db.query('SHOW TRIGGERS');
  if (rows.some(row => row.Trigger === name)) await db.query(`DROP TRIGGER \`${name}\``);
  await db.query(sql);
}

export async function up(db) {
  await addOwnership(db, 'Hospital', 'Hospital', 'fk_hospital_user', 'uq_hospital_user');
  await addOwnership(db, 'Organization', 'Organization', 'fk_organization_user', 'uq_organization_user');

  if (!(await columnExists(db, 'Donation', 'Hospital_ID'))) {
    await db.query('ALTER TABLE Donation ADD COLUMN Hospital_ID INT NULL AFTER Donor_ID');
  }
  if (!(await indexExists(db, 'Donation', 'idx_donation_hospital_status_date'))) {
    await db.query('ALTER TABLE Donation ADD INDEX idx_donation_hospital_status_date (Hospital_ID, Donation_Status, Donation_Date)');
  }
  if (!(await foreignKeyExists(db, 'Donation', 'fk_donation_hospital'))) {
    await db.query('ALTER TABLE Donation ADD CONSTRAINT fk_donation_hospital FOREIGN KEY (Hospital_ID) REFERENCES Hospital (Hospital_ID) ON DELETE SET NULL');
  }

  await db.query(`CREATE TABLE IF NOT EXISTS IntegrationOutbox (
    Event_ID BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    Event_Type VARCHAR(80) NOT NULL,
    Aggregate_Type VARCHAR(80) NOT NULL,
    Aggregate_ID VARCHAR(120) NOT NULL,
    Payload JSON NOT NULL,
    Status VARCHAR(16) NOT NULL DEFAULT 'Pending',
    Attempt_Count INT UNSIGNED NOT NULL DEFAULT 0,
    Next_Attempt_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Last_Error VARCHAR(500) NULL,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Processed_At DATETIME NULL,
    Locked_Until DATETIME NULL,
    INDEX idx_outbox_ready (Status, Next_Attempt_At, Event_ID),
    INDEX idx_outbox_aggregate (Aggregate_Type, Aggregate_ID, Event_ID),
    INDEX idx_outbox_created (Created_At)
  ) ENGINE=InnoDB`);

  const insertSql = `CREATE TRIGGER trg_DonationLastDate_Insert AFTER INSERT ON Donation FOR EACH ROW
    UPDATE Donor SET Last_Donation_Date=(SELECT MAX(Donation_Date) FROM Donation WHERE Donor_ID=NEW.Donor_ID AND Donation_Status='Approved') WHERE Donor_ID=NEW.Donor_ID`;
  const updateSql = `CREATE TRIGGER trg_DonationLastDate_Update AFTER UPDATE ON Donation FOR EACH ROW
    BEGIN
      UPDATE Donor SET Last_Donation_Date=(SELECT MAX(Donation_Date) FROM Donation WHERE Donor_ID=OLD.Donor_ID AND Donation_Status='Approved') WHERE Donor_ID=OLD.Donor_ID;
      IF NEW.Donor_ID<>OLD.Donor_ID THEN
        UPDATE Donor SET Last_Donation_Date=(SELECT MAX(Donation_Date) FROM Donation WHERE Donor_ID=NEW.Donor_ID AND Donation_Status='Approved') WHERE Donor_ID=NEW.Donor_ID;
      END IF;
    END`;
  await createTrigger(db, 'trg_DonationLastDate_Insert', insertSql);
  await createTrigger(db, 'trg_DonationLastDate_Update', updateSql);
  const [oldTrigger] = await db.execute('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?', ['trg_UpdateLastDonation']);
  if (oldTrigger.length) await db.query('DROP TRIGGER `trg_UpdateLastDonation`');

  await db.query(`UPDATE Donor d
    LEFT JOIN (SELECT Donor_ID, MAX(Donation_Date) AS Last_Approved
               FROM Donation WHERE Donation_Status='Approved' GROUP BY Donor_ID) latest
      ON latest.Donor_ID=d.Donor_ID
    SET d.Last_Donation_Date=latest.Last_Approved`);
}
