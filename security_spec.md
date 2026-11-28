# Security Specification & Hardening Audit — CBCC BNCC Platoon Portal

## 1. Data & Access Invariants
1. **Default-Deny Catch-All**: All unmatched Firestore paths are denied (`allow read, write: if false;`).
2. **Tiered RBAC Identity**:
   - **Bootstrapped Super Admin**: `sajondey102@gmail.com` (`email_verified == true`) or `/admins/{uid}` with `role == 'super_admin'`.
   - **Administrators (`isAdmin()`)**: Super Admin or verified admin roles (`admin`, `exam_admin`, `qr_admin`, `attendance_officer`) in `/admins/{uid}` or `/users/{uid}`.
   - **Moderators (`isModerator()`)**: `isAdmin()` or verified moderator roles (`moderator`, `sub_admin`) in `/admins/{uid}` or `/users/{uid}`. Moderators may review/triage applications, admissions, notifications, and contact messages, but cannot delete critical records, modify `system_settings`, or create/promote admins.
   - **Regular Users (`isAuthenticatedUser()`)**: Non-anonymous Firebase Auth users linked to `/users/{request.auth.uid}`.
3. **UID-Linked User Profiles (`/users/{uid}`)**: Every authenticated Firebase user is linked to `/users/{request.auth.uid}`. Users can read/update only safe non-privileged profile fields on their own document and cannot self-assign `role`, `isActive`, or `accountStatus`.
4. **Applicant & Application PII Isolation (`/applicants/{id}`, `/applications/{id}`, `/admissions/{id}`)**: Reads/queries are restricted strictly to `isModerator()` (Admins & Moderators) or `resource.data.ownerUid == request.auth.uid`. Public enrollment create enforces `status == 'Pending'` and blocks role/approval forgery. Verified-email users may claim an unowned `'public_applicant'` record only when `existing().studentEmail.lower() == request.auth.token.email.lower()` and only updating `['ownerUid', 'updatedAt']`.
5. **Contact Messages Privacy (`/contact_messages/{id}`)**: Visitors or signed-in users may create inquiries with initial `status == 'unread'` and strict field size limits. Public listing/reading by third parties is blocked (`allow get/list` strictly to `isModerator()` or owner UID).
6. **System & CMS Settings (`/system_settings/{id}`, `/cms_settings/{id}`)**: Public read for non-sensitive site operational toggles; writes restricted strictly to `isAdmin()`.
7. **Non-PII Public QR Projection (`/public_qr_cards/{id}`)**: Exposes only non-PII verification fields (`cadetId`, `fullNameEnglish`, `fullNameBangla`, `status`, `isValidCadet`, `photo`). Public `list` enumeration is denied (`allow list: if isAdmin();`).
8. **Exam Answer Key Isolation**: `/question_bank` and `/exam_answer_keys` are readable/writable strictly by `isAdmin()`.
9. **Immutable Sequential Counter**: `/counters/applicant_id` can only advance monotonically by `+1` during enrollment transactions or be managed by admins.
10. **Scoped Messaging, Notifications, Profile Changes & Activity Logs**: `/messages/{id}` and `/notifications/{id}` restrict reads to staff, broadcast `ALL` announcements, or owner UID; `/pending_profile_changes/{id}` requires `ownerUid == request.auth.uid`, `status == 'pending'`, and `<= 20` fields on create; `/activity_logs/{id}` scopes cadet reads/creates strictly to `ownerUid == request.auth.uid`.

## 2. Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated PII Read**: Unauthenticated `getDocs(collection(db, "applicants"))` or `contact_messages` or `users` -> Denied.
2. **Cross-Tenant Applicant/Admission/Contact/Activity Read**: Signed-in user `uid-B` reads `applicants/1111`, `admissions/1111`, `contact_messages/INQ-1`, or `activity_logs` owned by `uid-A` -> Denied.
3. **Privilege Escalation via `/users/{uid}` Self-Elevation**: Signed-in user writes `updateDoc(doc(db, "users", uid), { role: "super_admin" })` or `{ role: "admin" }` -> Denied.
4. **Privilege Escalation via Self-Admin Write**: Non-super-admin creates `admins/{uid}` -> Denied.
5. **Shadow Field Injection on Applicant/Contact/Profile Change**: Creating applicant with `status: "Approved"`, contact message with `status: "resolved"`, or `pending_profile_changes` with `status: "approved"` -> Denied.
6. **Immutable Ownership Tampering / Unverified Claim**: User `uid-B` updates `applicants/1111` or `users/uid-A` changing `ownerUid`/`uid`, or unverified email user claims `public_applicant` -> Denied.
7. **Moderator Overreach**: Moderator attempts `updateDoc(doc(db, "system_settings", "portal_config"), ...)` or `deleteDoc(doc(db, "applicants", "1111"))` -> Denied.
8. **Exam Answer Key Exfiltration**: Candidate queries `question_bank` or `exam_answer_keys` -> Denied.
9. **Direct Result Forgery / Mutation**: Non-admin updates `exam_results/{id}` to raise `obtainedMarks` -> Denied.
10. **Counter Reset / Jump Attack**: Non-admin updates `counters/applicant_id` by > 1 -> Denied.
11. **System/CMS Settings Tampering**: Non-admin updates `system_settings/portal_config` or `cms_settings/global_config` -> Denied.
12. **Oversized Document ID / Payload Poisoning**: Document ID > 128 chars or invalid path chars (`"../bad/id"`) or oversized text -> Denied.
