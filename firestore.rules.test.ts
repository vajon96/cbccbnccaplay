/**
 * Firestore Security Rules Test Specification (TDD Security Suite)
 * Documents and verifies expected ALLOW / PERMISSION_DENIED outcomes against firestore.rules.
 */

export interface SecurityTestCase {
  id: string;
  title: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: 'unauthenticated' | 'cadet_A' | 'cadet_B' | 'moderator' | 'admin' | 'super_admin';
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 'SEC-01',
    title: 'Unauthenticated list on applicants PII collection',
    collection: 'applicants',
    operation: 'list',
    actor: 'unauthenticated',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-02',
    title: 'Cross-tenant read of another cadet applicant or admission profile',
    collection: 'admissions',
    operation: 'get',
    actor: 'cadet_B',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-03',
    title: 'Non-admin self-promotion in users profile collection',
    collection: 'users',
    operation: 'update',
    actor: 'cadet_A',
    payload: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-04',
    title: 'Non-admin self-promotion in admins collection',
    collection: 'admins',
    operation: 'create',
    actor: 'cadet_A',
    payload: { name: 'Attacker', role: 'super_admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-05',
    title: 'Applicant self-approval status forgery on create',
    collection: 'applicants',
    operation: 'create',
    actor: 'cadet_A',
    payload: { ownerUid: 'cadet_A', status: 'Approved', role: 'cadet' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-06',
    title: 'Public visitor reading or listing contact_messages PII',
    collection: 'contact_messages',
    operation: 'list',
    actor: 'unauthenticated',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-07',
    title: 'Moderator modifying system_settings operational flags',
    collection: 'system_settings',
    operation: 'update',
    actor: 'moderator',
    payload: { maintenanceMode: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-08',
    title: 'Moderator reviewing and marking contact_messages as read',
    collection: 'contact_messages',
    operation: 'update',
    actor: 'moderator',
    payload: { status: 'read', handledBy: 'mod_1' },
    expected: 'ALLOW',
  },
  {
    id: 'SEC-09',
    title: 'Candidate reading raw question_bank / exam_answer_keys',
    collection: 'exam_answer_keys',
    operation: 'get',
    actor: 'cadet_A',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-10',
    title: 'Candidate modifying published exam_results score',
    collection: 'exam_results',
    operation: 'update',
    actor: 'cadet_A',
    payload: { obtainedMarks: 100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-11',
    title: 'Non-admin jumping sequential ID counter by > 1',
    collection: 'counters',
    operation: 'update',
    actor: 'cadet_A',
    payload: { currentId: 9999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'SEC-12',
    title: 'Non-admin system_settings or cms_settings tampering',
    collection: 'system_settings',
    operation: 'update',
    actor: 'cadet_A',
    payload: { siteTitle: 'Hijacked' },
    expected: 'PERMISSION_DENIED',
  },
];
