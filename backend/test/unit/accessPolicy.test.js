import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPAT } from '../../src/services/domain.js';
import { canFulfilHospitalRequest, canReadDonorDetails, canReviewDonation, inventoryAccess, requestDetailAccess, requestListAccess } from '../../src/services/accessPolicy.js';

test('all eight red-cell ABO/Rh recipient rules are explicit', () => {
  assert.deepEqual(COMPAT, {
    'O-': ['O-'], 'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'], 'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'], 'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
  });
});

test('request-list authorization scopes hospitals and organizations and rejects donors', () => {
  assert.equal(requestListAccess('Donor', 4).allowed, false);
  assert.deepEqual(requestListAccess('Admin', 1), { allowed: true, where: '', values: [] });
  assert.deepEqual(requestListAccess('Hospital', 7), { allowed: true, where: 'r.Hospital_ID=(SELECT Hospital_ID FROM Hospital WHERE User_ID=? LIMIT 1)', values: [7] });
  assert.deepEqual(requestListAccess('Organization', 9), { allowed: true, where: 'r.Organization_ID=(SELECT Organization_ID FROM Organization WHERE User_ID=? LIMIT 1)', values: [9] });
});

test('individual request access rejects donors and retains owner predicates', () => {
  assert.equal(requestDetailAccess('Donor', 2).allowed, false);
  assert.equal(requestDetailAccess('Admin', 1).predicate, '');
  assert.match(requestDetailAccess('Hospital', 3).predicate, /Hospital_ID=.*User_ID=\?/);
  assert.match(requestDetailAccess('Organization', 5).predicate, /Organization_ID=.*User_ID=\?/);
});

test('only matching business and admin roles can retrieve donor details', () => {
  assert.equal(canReadDonorDetails('Donor'), false);
  for (const role of ['Hospital', 'Organization', 'Admin']) assert.equal(canReadDonorDetails(role), true);
});

test('inventory access is system-wide for admins and hospital-scoped for hospitals', () => {
  assert.equal(inventoryAccess('Donor', 1).allowed, false);
  assert.equal(inventoryAccess('Organization', 1).allowed, false);
  assert.equal(inventoryAccess('Admin', 1).systemWide, true);
  assert.deepEqual(inventoryAccess('Hospital', 8).values, [8]);
  assert.match(inventoryAccess('Hospital', 8).predicate, /Hospital_ID=/);
});

test('hospital donation review requires a matching non-null hospital association', () => {
  assert.equal(canReviewDonation('Hospital', 3, 3), true);
  assert.equal(canReviewDonation('Hospital', 4, 3), false);
  assert.equal(canReviewDonation('Hospital', null, 3), false);
  assert.equal(canReviewDonation('Admin', null, null), true);
});

test('only an owning hospital or admin can fulfil a hospital request', () => {
  assert.equal(canFulfilHospitalRequest('Hospital', 2, 2), true);
  assert.equal(canFulfilHospitalRequest('Hospital', 2, 3), false);
  assert.equal(canFulfilHospitalRequest('Organization', 2, 2), false);
  assert.equal(canFulfilHospitalRequest('Admin', 2, undefined), true);
  assert.equal(canFulfilHospitalRequest('Admin', null, undefined), false);
});
