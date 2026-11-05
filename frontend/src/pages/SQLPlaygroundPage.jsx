import { useState } from 'react';
import { sqlPlaygroundApi } from '../services/api.js';

const sections = {
  'DDL': [
    { name: 'CREATE TABLE', sql: `CREATE TABLE SQL_Demo_Notes (
  Note_ID INT PRIMARY KEY AUTO_INCREMENT,
  Description VARCHAR(150) NOT NULL,
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)` },
    { name: 'ALTER TABLE', sql: `ALTER TABLE SQL_Demo_Notes
ADD COLUMN Category VARCHAR(50)` },
    { name: 'DROP TABLE', sql: `DROP TABLE SQL_Demo_Notes` },
    { name: 'SHOW TABLES', sql: `SHOW TABLES` },
    { name: 'DESCRIBE TABLE', sql: `DESCRIBE Donor` }
  ],
  'DML': [
    { name: 'INSERT', sql: `INSERT INTO User (Name, Email)
VALUES ('Demo Donor', 'demo.donor.unique@example.com')` },
    { name: 'UPDATE', sql: `UPDATE Donor
SET Availability_Status = 0
WHERE Donor_ID = 1` },
    { name: 'DELETE', sql: `DELETE FROM User
WHERE Email = 'demo.donor.unique@example.com'` }
  ],
  'DQL': [
    { name: 'SELECT ALL', sql: `SELECT * FROM Donor` },
    { name: 'SELECT WITH WHERE', sql: `SELECT * FROM Donor
WHERE Availability_Status = 1` },
    { name: 'ORDER BY', sql: `SELECT * FROM Donor
ORDER BY Age DESC` },
    { name: 'LIMIT', sql: `SELECT * FROM Donor
LIMIT 3` }
  ],
  'JOINS': [
    { name: 'INNER JOIN', sql: `SELECT d.Donor_ID, u.Name, bg.Blood_Group
FROM Donor d
INNER JOIN User u ON d.User_ID = u.User_ID
INNER JOIN BloodGroup bg ON d.BloodGroup_ID = bg.BloodGroup_ID` },
    { name: 'LEFT JOIN', sql: `SELECT u.Name, d.Donor_ID
FROM User u
LEFT JOIN Donor d ON u.User_ID = d.User_ID` },
    { name: 'MULTI-TABLE JOIN', sql: `SELECT d.Donor_ID, u.Name, u.Email, bg.Blood_Group, d.Age
FROM Donor d
JOIN User u ON d.User_ID = u.User_ID
JOIN BloodGroup bg ON d.BloodGroup_ID = bg.BloodGroup_ID
ORDER BY d.Donor_ID` }
  ],
  'AGGREGATES': [
    { name: 'COUNT', sql: `SELECT COUNT(*) AS Total_Donors FROM Donor` },
    { name: 'SUM', sql: `SELECT SUM(Quantity) AS Total_Donated_Quantity FROM Donation` },
    { name: 'AVG', sql: `SELECT AVG(Age) AS Average_Donor_Age FROM Donor` },
    { name: 'MIN / MAX', sql: `SELECT MIN(Age) AS Youngest, MAX(Age) AS Oldest FROM Donor` }
  ],
  'GROUPING': [
    { name: 'GROUP BY', sql: `SELECT bg.Blood_Group, COUNT(d.Donor_ID) AS Total_Donors
FROM Donor d
JOIN BloodGroup bg ON d.BloodGroup_ID = bg.BloodGroup_ID
GROUP BY bg.Blood_Group` },
    { name: 'HAVING', sql: `SELECT bg.Blood_Group, COUNT(d.Donor_ID) AS Total_Donors
FROM Donor d
JOIN BloodGroup bg ON d.BloodGroup_ID = bg.BloodGroup_ID
GROUP BY bg.Blood_Group
HAVING COUNT(d.Donor_ID) >= 1` },
    { name: 'GROUP + ORDER', sql: `SELECT Donation_Status, COUNT(*) AS Total_Donations
FROM Donation
GROUP BY Donation_Status
ORDER BY Total_Donations DESC` }
  ],
  'SUBQUERIES': [
    { name: 'IN SUBQUERY', sql: `SELECT * FROM Donor
WHERE BloodGroup_ID IN (
  SELECT BloodGroup_ID FROM BloodGroup
  WHERE Blood_Group IN ('A+', 'O+')
)` },
    { name: 'SCALAR SUBQUERY', sql: `SELECT * FROM Donor
WHERE Age > (SELECT AVG(Age) FROM Donor)` },
    { name: 'EXISTS SUBQUERY', sql: `SELECT u.User_ID, u.Name
FROM User u
WHERE EXISTS (
  SELECT 1 FROM Donor d WHERE d.User_ID = u.User_ID
)` }
  ],
  'INDEXES': [
    { name: 'CREATE INDEX', sql: `CREATE INDEX idx_demo_donor_age ON Donor(Age)` },
    { name: 'SHOW INDEXES', sql: `SHOW INDEX FROM Donor` },
    { name: 'DROP INDEX', sql: `DROP INDEX idx_demo_donor_age ON Donor` }
  ],
  'ADVANCED': [
    { name: 'VIEW: CREATE', sql: `CREATE OR REPLACE VIEW vw_demo_available_donors AS
SELECT Donor_ID, User_ID, BloodGroup_ID, Age
FROM Donor
WHERE Availability_Status = 1` },
    { name: 'VIEW: QUERY', sql: `SELECT * FROM vw_demo_available_donors` },
    { name: 'VIEW: DROP', sql: `DROP VIEW vw_demo_available_donors` },
    { name: 'TRANSACTION: START', sql: `START TRANSACTION` },
    { name: 'TRANSACTION: COMMIT', sql: `COMMIT` },
    { name: 'TRANSACTION: ROLLBACK', sql: `ROLLBACK` },
    { name: 'PROCEDURE: CREATE', sql: `CREATE PROCEDURE sp_demo_donor_count()
SELECT COUNT(*) AS Total_Donors FROM Donor` },
    { name: 'PROCEDURE: CALL', sql: `CALL sp_demo_donor_count()` },
    { name: 'PROCEDURE: DROP', sql: `DROP PROCEDURE sp_demo_donor_count` },
    { name: 'FUNCTION: CREATE', sql: `CREATE FUNCTION fn_demo_donor_count()
RETURNS INT DETERMINISTIC
RETURN (SELECT COUNT(*) FROM Donor)` },
    { name: 'FUNCTION: QUERY', sql: `SELECT fn_demo_donor_count() AS Total_Donors` },
    { name: 'FUNCTION: DROP', sql: `DROP FUNCTION fn_demo_donor_count` }
  ]
};

export default function SQLPlaygroundPage() {
  const [category, setCategory] = useState('DQL');
  const [sql, setSql] = useState(sections.DQL[0].sql);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function execute() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await sqlPlaygroundApi.execute(sql);
      setResult(data);
    } catch (err) {
      setError(err.message || 'SQL execution failed.');
    } finally {
      setLoading(false);
    }
  }

  const button = {
    padding: '9px 13px',
    border: '1px solid #cbd5e1',
    borderRadius: 7,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13
  };

  return (
    <div style={{ padding: 24, maxWidth: 1250, margin: 'auto', color: '#172033' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>SQL Operations Lab</h1>
      <p style={{ color: '#64748b', marginBottom: 20 }}>
        Interactive SQL demonstrations embedded in the Blood Donation application.
        Statements execute against the isolated BloodDonationPlayground MySQL database.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {Object.keys(sections).map(key => (
          <button key={key} onClick={() => {
            setCategory(key);
            setSql(sections[key][0].sql);
            setResult(null);
            setError('');
          }} style={{
            ...button,
            background: category === key ? '#1d4ed8' : '#fff',
            color: category === key ? '#fff' : '#172033'
          }}>{key}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {sections[category].map(item => (
          <button key={item.name} style={button} onClick={() => {
            setSql(item.sql);
            setResult(null);
            setError('');
          }}>{item.name}</button>
        ))}
      </div>

      <textarea
        value={sql}
        onChange={e => setSql(e.target.value)}
        spellCheck={false}
        aria-label="SQL statement editor"
        style={{
          width: '100%',
          minHeight: 260,
          padding: 18,
          borderRadius: 10,
          border: '1px solid #334155',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'Consolas, monospace',
          fontSize: 14,
          lineHeight: 1.7,
          resize: 'vertical',
          boxSizing: 'border-box'
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
        <button onClick={execute} disabled={loading || !sql.trim()} style={{
          ...button, background: '#2563eb', color: '#fff', border: 0
        }}>{loading ? 'Executing...' : '▶ Execute SQL'}</button>
        <span style={{ color: '#64748b', fontSize: 12 }}>Admin access only · MySQL</span>
      </div>

      {error && <div style={{
        marginTop: 20, padding: 14, background: '#fee2e2',
        color: '#991b1b', borderRadius: 8
      }}>{error}</div>}

      {result && <div style={{ marginTop: 24 }}>
        <div style={{
          padding: 14, background: '#dcfce7', color: '#166534',
          borderRadius: 8, marginBottom: 14
        }}>✓ {result.message}</div>

        {result.columns?.length > 0 && <div style={{
          overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{result.columns.map(col => <th key={col} style={{
              textAlign: 'left', padding: 12, background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0'
            }}>{col}</th>)}</tr></thead>
            <tbody>{result.rows.map((row, i) => <tr key={i}>
              {result.columns.map(col => <td key={col} style={{
                padding: 12, borderBottom: '1px solid #e2e8f0'
              }}>{row[col] === null ? 'NULL' : String(row[col] ?? '')}</td>)}
            </tr>)}</tbody>
          </table>
        </div>}
      </div>}
    </div>
  );
}
