# Security Specification & Hardening Audit — CBCC BNCC Platoon Portal

## 1. Data & Access Invariants
1. **Default-Deny Catch-All**: All unmatched Firestore paths are denied (`allow read, write: if false;`).
2. **Verified Firebase Identity**: All privileged admin writes (`isAdmin()`) and PII operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Bootstrapped Super Admin**: `sajondey102@gmail.com` (verified Google email) or any UID present in `/admins/{request.auth.uid}` with a valid role.
4. **Applicant PII Isolation**: `/applicants/{applicantId}` contains PII (phone, NID/birth reg, addresses, email, passwordHash). Reads/queries are restricted strictly to `isAdmin()` or `resource.data.ownerUid == request.auth.uid`.
5. **Non-PII Public QR Projection**: `/qr_records/{qrRecordId}` exposes only non-PII verification fields (`cadetId`, `fullNameEnglish`, `fullNameBangla`, `status`, `attendanceStatus`, `batch`, `photo`).
6. **Exam Answer Key Isolation**: `/question_bank` and `/exam_answer_keys` are readable/writable strictly by `isAdmin()`. Published `/exams/{examId}` documents strip answer keys (`correctAnswer` / `acceptedAnswers`) prior to candidate delivery.
7. **Immutable Sequential Counter**: `/counters/applicant_id` can only advance monotonically by `+1` during enrollment transactions or be managed by admins.
8. **Scoped Messaging**: `/messages/{messageId}` permits reads only for `isAdmin()`, platoon broadcast announcements (`recipientId == 'ALL'`), or private 1:1 thread participants (`ownerUid == request.auth.uid || senderId == request.auth.uid || recipientId == request.auth.uid`).

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated PII Read**: Unauthenticated client `getDocs(collection(db, "applicants"))` -> Denied.
2. **Cross-Tenant Applicant Read**: Signed-in user `uid-B` tries `getDoc(doc(db, "applicants", "1111"))` owned by `uid-A` -> Denied.
3. **Privilege Escalation via Self-Admin Write**: Signed-in non-admin writes `setDoc(doc(db, "admins", "uid-B"), { role: "super_admin" })` -> Denied.
4. **Shadow Field Injection on Applicant**: User tries creating applicant with `status: "Approved"` or `role: "super_admin"` -> Denied.
5. **Immutable Ownership Tampering**: User `uid-B` updates `applicants/1111` trying to change `ownerUid` to `uid-B` when `ownerUid == uid-A` -> Denied.
6. **Exam Answer Key Exfiltration**: Candidate `uid-A` queries `question_bank` or `exam_answer_keys` -> Denied.
7. **Draft Exam Snooping**: Non-admin reads `exams/{id}` where `status == "draft"` -> Denied.
8. **Direct Result Forgery / Mutation**: Non-admin updates an existing `exam_results/{id}` document to raise `obtainedMarks` -> Denied.
9. **Counter Reset / Jump Attack**: Non-admin writes `counters/applicant_id` setting `currentId: 500` or `currentId: existing + 100` -> Denied.
10. **CMS Tampering by Visitor**: Non-admin updates `cms_settings/global` or `cms_commander/profile` -> Denied.
11. **Private Message Eavesdropping**: User `uid-C` reads `messages/{id}` where `threadId == "applicant_1111"` owned by `uid-A` -> Denied.
12. **Oversized Document ID / Payload Poisoning**: Creating a document with ID length > 128 or invalid chars (`"../bad/id"`) or oversized fields -> Denied.
