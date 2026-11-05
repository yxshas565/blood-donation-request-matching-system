export function requestListAccess(role, userId) {
  if (role === 'Admin') return { allowed: true, where: '', values: [] };
  if (role === 'Hospital') return {
    allowed: true,
    where: 'r.Hospital_ID=(SELECT Hospital_ID FROM Hospital WHERE User_ID=? LIMIT 1)',
    values: [userId]
  };
  if (role === 'Organization') return {
    allowed: true,
    where: 'r.Organization_ID=(SELECT Organization_ID FROM Organization WHERE User_ID=? LIMIT 1)',
    values: [userId]
  };
  return { allowed: false };
}

export function requestDetailAccess(role, userId) {
  if (role === 'Admin') return { allowed: true, predicate: '', values: [] };
  if (role === 'Hospital') return {
    allowed: true,
    predicate: ' AND r.Hospital_ID=(SELECT Hospital_ID FROM Hospital WHERE User_ID=? LIMIT 1)',
    values: [userId]
  };
  if (role === 'Organization') return {
    allowed: true,
    predicate: ' AND r.Organization_ID=(SELECT Organization_ID FROM Organization WHERE User_ID=? LIMIT 1)',
    values: [userId]
  };
  return { allowed: false };
}

export function canReadDonorDetails(role) {
  return ['Hospital', 'Organization', 'Admin'].includes(role);
}

export function inventoryAccess(role, userId) {
  if (role === 'Admin') return { allowed: true, systemWide: true, values: [] };
  if (role === 'Hospital') return {
    allowed: true,
    systemWide: false,
    predicate: 'i.Hospital_ID=(SELECT Hospital_ID FROM Hospital WHERE User_ID=? LIMIT 1)',
    values: [userId]
  };
  return { allowed: false };
}

export function canReviewDonation(role, donationHospitalId, ownerHospitalId) {
  if (role === 'Admin') return true;
  return role === 'Hospital' && donationHospitalId !== null && donationHospitalId !== undefined
    && Number(donationHospitalId) === Number(ownerHospitalId);
}

export function canFulfilHospitalRequest(role, requestHospitalId, ownerHospitalId) {
  if (role === 'Admin') return requestHospitalId !== null && requestHospitalId !== undefined;
  return role === 'Hospital' && requestHospitalId !== null && requestHospitalId !== undefined
    && Number(requestHospitalId) === Number(ownerHospitalId);
}
