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
    const [rows] = await connection.execute('SELECT Hospital_ID FROM Hospital WHERE User_ID=? LIMIT 1', [user.userId]);
    return { Hospital_ID: rows[0]?.Hospital_ID };
  }
  if (user.role === 'Organization') {
    const [rows] = await connection.execute('SELECT Organization_ID FROM Organization WHERE User_ID=? LIMIT 1', [user.userId]);
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
    `SELECT * FROM BloodRequest WHERE Request_ID=? AND ${field}=?`, [id, value]
  );
  return rows[0] || null;
}

async function donorRowsFor(recipientGroup) {
  const allowed = COMPAT[recipientGroup];
  if (!allowed) throw Object.assign(new Error('Invalid blood group'), { status: 400 });
  const marks = allowed.map(() => '?').join(',');
  const [donors] = await mysqlPool.execute(
    `SELECT d.Donor_ID,d.User_ID,d.Availability_Status,d.Last_Donation_Date,
            b.Blood_Type,b.Rh_Factor,u.Name,u.Phone
       FROM Donor d JOIN BloodGroup b ON b.BloodGroup_ID=d.BloodGroup_ID
       JOIN \`User\` u ON u.User_ID=d.User_ID
      WHERE d.Availability_Status=1
        AND CONCAT(b.Blood_Type,b.Rh_Factor) IN (${marks})`,
    allowed
  );
  return donors;
}

export async function eligibleDonorRecipients(recipientGroup) {
  const donors = await donorRowsFor(recipientGroup);
  return donors.map(donor => ({ donorId: Number(donor.Donor_ID), userId: Number(donor.User_ID), bloodGroup: groupLabel(donor) }));
}

export async function matchDonors(recipientGroup, coords) {
  const donors = await donorRowsFor(recipientGroup);
  const donorIds = donors.map(donor => donor.Donor_ID);
  const locations = await getMongoDB().collection('DonorLocation')
    .find({ donor_id: { $in: donorIds } }).toArray();
  const locationByDonor = new Map(locations.map(location => [Number(location.donor_id), location]));
  let proximity = new Map();
  if (coords) {
    const nearby = await getMongoDB().collection('DonorLocation').find({
      donor_id: { $in: donorIds },
      location: { $near: { $geometry: { type: 'Point', coordinates: coords } } }
    }).toArray();
    proximity = new Map(nearby.map((location, index) => [Number(location.donor_id), index + 1]));
  }
  const approvedHistory = await getMongoDB().collection('DonationHistory').aggregate([
    { $match: { donor_id: { $in: donorIds }, donation_status: 'Approved' } },
    { $group: { _id: '$donor_id', count: { $sum: 1 } } }
  ]).toArray();
  const countByDonor = new Map(approvedHistory.map(row => [Number(row._id), row.count]));

  const matches = donors.map(donor => {
    const location = locationByDonor.get(Number(donor.Donor_ID));
    return {
      donorId: Number(donor.Donor_ID),
      name: donor.Name,
      phone: donor.Phone || null,
      bloodGroup: groupLabel(donor),
      availability: Boolean(donor.Availability_Status),
      lastDonationDate: donor.Last_Donation_Date || null,
      location: location ? { city: location.city || null, area: location.area || null } : null,
      distanceRank: proximity.get(Number(donor.Donor_ID)) || null,
      approvedDonationCount: countByDonor.get(Number(donor.Donor_ID)) || 0
    };
  });
  matches.sort((a, b) => coords
    ? (a.distanceRank ?? Infinity) - (b.distanceRank ?? Infinity)
    : (b.approvedDonationCount - a.approvedDonationCount)
      || String(a.lastDonationDate || '').localeCompare(String(b.lastDonationDate || '')));
  return {
    recipientBloodGroup: recipientGroup,
    geographicRanking: Boolean(coords),
    clinicalDisclaimer: 'Matching is informational. Actual donor eligibility and transfusion compatibility require appropriate clinical screening.',
    matches
  };
}
