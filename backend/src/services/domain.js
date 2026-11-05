import { mysqlPool } from '../config/mysql.js';
import { getMongoDB } from '../config/mongodb.js';

export const COMPAT = {
  'O-': ['O-'], 'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'], 'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'], 'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
};

export const groupLabel = row => `${row.Blood_Type}${row.Rh_Factor}`;

export async function ownerFor(user, connection = mysqlPool) {
  if (user.role === 'Hospital') {
    const [rows] = await connection.execute(
      'SELECT Hospital_ID FROM Hospital WHERE User_ID=? LIMIT 1',
      [user.userId]
    );
    return { Hospital_ID: rows[0]?.Hospital_ID };
  }

  if (user.role === 'Organization') {
    const [rows] = await connection.execute(
      'SELECT Organization_ID FROM Organization WHERE User_ID=? LIMIT 1',
      [user.userId]
    );
    return { Organization_ID: rows[0]?.Organization_ID };
  }

  return {};
}

export async function ownedRequest(user, id, connection = mysqlPool) {
  const owner = await ownerFor(user, connection);
  const field = owner.Hospital_ID ? 'Hospital_ID' : 'Organization_ID';
  const value = owner[field];

  if (!value) return null;

  const [rows] = await connection.execute(
    `SELECT * FROM BloodRequest WHERE Request_ID=? AND ${field}=?`,
    [id, value]
  );

  return rows[0] || null;
}

async function donorRowsFor(recipientGroup) {
  const allowed = COMPAT[recipientGroup];

  if (!allowed) {
    throw Object.assign(new Error('Invalid blood group'), { status: 400 });
  }

  const parsed = /^(AB|A|B|O)([+-])$/.exec(recipientGroup);
  if (!parsed) {
    throw Object.assign(new Error('Invalid blood group'), { status: 400 });
  }

  const [, bloodType, rhFactor] = parsed;

  const [groupRows] = await mysqlPool.execute(
    'SELECT BloodGroup_ID FROM BloodGroup WHERE Blood_Type=? AND Rh_Factor=? LIMIT 1',
    [bloodType, rhFactor]
  );

  if (!groupRows.length) {
    throw Object.assign(new Error('Recipient blood group is not configured'), { status: 400 });
  }

  // Stored procedure performs ABO/Rh compatibility filtering in MySQL.
  const [procedureResults] = await mysqlPool.query(
    'CALL sp_FindCompatibleDonors(?)',
    [groupRows[0].BloodGroup_ID]
  );

  const donors = Array.isArray(procedureResults?.[0])
    ? procedureResults[0]
    : [];

  if (!donors.length) return [];

  // Stored function calculates approved donation counts in MySQL.
  const donorIds = donors.map(donor => Number(donor.Donor_ID));
  const placeholders = donorIds.map(() => '?').join(',');

  const [countRows] = await mysqlPool.execute(
    `SELECT Donor_ID,
            fn_ApprovedDonationCount(Donor_ID) AS Approved_Donation_Count
       FROM Donor
      WHERE Donor_ID IN (${placeholders})`,
    donorIds
  );

  const countByDonor = new Map(
    countRows.map(row => [
      Number(row.Donor_ID),
      Number(row.Approved_Donation_Count || 0)
    ])
  );

  return donors.map(donor => ({
    ...donor,
    approvedDonationCount: countByDonor.get(Number(donor.Donor_ID)) || 0
  }));
}

export async function eligibleDonorRecipients(recipientGroup) {
  const donors = await donorRowsFor(recipientGroup);

  return donors.map(donor => ({
    donorId: Number(donor.Donor_ID),
    userId: Number(donor.User_ID),
    bloodGroup: groupLabel(donor)
  }));
}

export async function matchDonors(recipientGroup, coords) {
  const donors = await donorRowsFor(recipientGroup);
  const donorIds = donors.map(donor => Number(donor.Donor_ID));

  const locations = donorIds.length
    ? await getMongoDB().collection('DonorLocation')
        .find({ donor_id: { $in: donorIds } }).toArray()
    : [];

  const locationByDonor = new Map(
    locations.map(location => [Number(location.donor_id), location])
  );

  let proximity = new Map();

  if (coords && donorIds.length) {
    const nearby = await getMongoDB().collection('DonorLocation').find({
      donor_id: { $in: donorIds },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coords
          }
        }
      }
    }).toArray();

    proximity = new Map(
      nearby.map((location, index) => [
        Number(location.donor_id),
        index + 1
      ])
    );
  }

  const matches = donors.map(donor => {
    const donorId = Number(donor.Donor_ID);
    const location = locationByDonor.get(donorId);

    return {
      donorId,
      name: donor.Name,
      phone: donor.Phone || null,
      bloodGroup: groupLabel(donor),
      availability: Boolean(donor.Availability_Status),
      lastDonationDate: donor.Last_Donation_Date || null,
      location: location
        ? { city: location.city || null, area: location.area || null }
        : null,
      distanceRank: proximity.get(donorId) || null,
      approvedDonationCount: Number(donor.approvedDonationCount || 0)
    };
  });

  matches.sort((a, b) => coords
    ? (a.distanceRank ?? Infinity) - (b.distanceRank ?? Infinity)
    : (b.approvedDonationCount - a.approvedDonationCount)
      || String(a.lastDonationDate || '').localeCompare(String(b.lastDonationDate || ''))
  );

  return {
    recipientBloodGroup: recipientGroup,
    geographicRanking: Boolean(coords),
    clinicalDisclaimer: 'Matching is informational. Actual donor eligibility and transfusion compatibility require appropriate clinical screening.',
    matches
  };
}
