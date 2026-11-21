/**
 * Firestore Security Rules Test Specification (TDD Dirty Dozen Suite)
 * Documents and verifies expected ALLOW / PERMISSION_DENIED outcomes against firestore.rules.
 */

export interface SecurityTestCase {
  id: string;
  title: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: 'unauthenticated' | 'cadet_A' | 'cadet_B' | 'admin' | 'super_admin';
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    title: 'Unauthenticated list on applicants PII collection',
    collection: 'applicants',
    operation: 'list',
    actor: 'unauthenticated',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    title: 'Cross-tenant read of another cadet applicant profile',
    collection: 'applicants',
    operation: 'get',
    actor: 'cadet_B',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    title: 'Non-admin self-promotion in admins collection',
    collection: 'admins',
    operation: 'create',
    actor: 'cadet_A',
    payload: { name: 'Attacker', role: 'super_admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    title: 'Applicant self-approval status forgery on create',
    collection: 'applicants',
    operation: 'create',
    actor: 'cadet_A',
    payload: { ownerUid: 'cadet_A', status: 'Approved', role: 'cadet' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    title: 'Non-owner hijacking ownerUid via applicant update',
    collection: 'applicants',
    operation: 'update',
    actor: 'cadet_B',
    payload: { ownerUid: 'cadet_B' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    title: 'Candidate reading raw question_bank / exam_answer_keys',
    collection: 'exam_answer_keys',
    operation: 'get',
    actor: 'cadet_A',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    title: 'Candidate reading unpublished draft exam',
    collection: 'exams',
    operation: 'get',
    actor: 'cadet_A',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    title: 'Candidate modifying published exam_results score',
    collection: 'exam_results',
    operation: 'update',
    actor: 'cadet_A',
    payload: { obtainedMarks: 100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    title: 'Non-admin jumping sequential ID counter by > 1',
    collection: 'counters',
    operation: 'update',
    actor: 'cadet_A',
    payload: { currentId: 9999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    title: 'Unauthenticated or non-admin CMS tampering',
    collection: 'cms_settings',
    operation: 'update',
    actor: 'cadet_A',
    payload: { siteTitle: 'Hijacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    title: 'Third-party cadet reading private 1:1 applicant-admin message thread',
    collection: 'messages',
    operation: 'get',
    actor: 'cadet_B',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    title: 'Admin deleting/updating adminTokens or security_logs without admin auth',
    collection: 'security_logs',
    operation: 'delete',
    actor: 'cadet_A',
    expected: 'PERMISSION_DENIED',
  },
];
