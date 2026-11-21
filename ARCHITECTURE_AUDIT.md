# Architecture Audit & Modernization Specification

**Platform:** Cox's Bazar City College BNCC Platoon Portal  
**Unit:** Army Wing • 15 BNCC Battalion • Karnaphuli Regiment • E Company  
**Primary Languages:** Bengali (বাংলা) & English  

---

## 1. System Topology

```text
[React 19 + Vite 6 + Tailwind v4 SPA + Workbox PWA]
   ├── Public Portal: Home, About, Activities, Notices, Gallery, Cadets, Incharges, Guide, Contact, Enroll, Admit Card, Offline Form, QR Verifier
   ├── Examination Portal: /exam, /exam/login, /exam/dashboard, /exam/instructions/:examId, /exam/take/:examId, /exam/result/:attemptId
   ├── Cadet & Admin Portals: /login, /dashboard, /messenger, /admin/dashboard, /admin/cms, /admin/qr-dashboard, /admin2/dashboard, /exam/admin
   │
   ├── Express 5 Server (server.ts, Port 3000)
   │     ├── Security Headers & Rate Limiting (in-memory sliding window)
   │     ├── Auth & Session Engine: Firebase ID token verification, HMAC-SHA256 HttpOnly cookie (bncc_session), impersonation state sync
   │     ├── Exam Answer Key Vault: AES-256-GCM sealed key envelopes (/api/exam/keys, /api/exam/submit) + HMAC-SHA256 result signatures
   │     └── AI Service Proxy: Gemini API server proxy (/api/gemini/chat, /faq, /summary, /insights, /generate-exam, /analyze-circular)
   │
   └── Firebase Cloud Firestore & Firebase Auth
         ├── Bootstrapped Super Admin: sajondey102@gmail.com (Google Sign-In)
         └── Hardened Role-Based & Owner-Scoped Rules (firestore.rules & DRAFT_firestore.rules)
```

---

## 2. Authentication & 8-Role RBAC Matrix (`src/lib/rbac.ts`)

1. **`super_admin`** — Full platform governance, admin account provisioning, CMS publishing, audit logs, exams, approvals, and deletion.
2. **`admin`** — System administration, applicant approvals, CMS, QR attendance, exams, messenger, password resets, exports.
3. **`sub_admin`** — Applicant review/approval, audit log viewing, messenger support.
4. **`exam_admin`** — MCQ/CQ examination creation, answer key sealing, manual CQ grading, exam exports.
5. **`qr_admin`** — QR attendance scanning, event/session tracking, cadet verification.
6. **`attendance_officer`** — Duty-scoped QR attendance operations.
7. **`cadet`** — Enrolled cadet dashboard, profile edit requests, messenger notices/support, online exams.
8. **`user`** — Registered applicant dashboard, admit card, offline/online status tracking, examinations.

**Session Security (`src/lib/auth.ts`, `src/context/AuthContext.tsx`, `server.ts`):**
- Zero client-side secret environment defines (`GEMINI_API_KEY`, `VITE_ADMIN_PASSWORD` removed) and zero plaintext URL credential parameters (`?pw=` removed).
- Server issues signed `HttpOnly; SameSite=Lax` cookies (`bncc_session`) verified on privileged Express routes.
- Admin impersonation preserves `impersonatedBy` metadata and renders an interactive `<ImpersonationBanner />` with one-click restoration.

---

## 3. Data & Privacy Architecture (`firestore.rules`)

- **PII Isolation:** `applicants` is owner-scoped (`ownerUid == request.auth.uid`) and admin-readable. Public QR verification reads non-sensitive public projection cards stored in `public_qr_cards/{id}` (name, session, institution, photo, verification status), omitting DOB, phone numbers, NID, and home address.
- **Query Indexing Compliance:** Cadet listeners (`messenger`, `notifications`, `exam_attempts`, `applicants`) use single-field equality filters (`ownerUid == auth.currentUser.uid`, `recipientId == "ALL"`, `targetId == "ALL"`) with client-side timestamp sorting, preventing missing composite-index runtime errors.
- **Exam Confidentiality:** Candidate-readable `exams/{examId}` strips `correctOption` and `explanation` fields from question objects (`stripQuestionKeys()`), keeping plain answer keys solely in admin-only `exam_answer_keys/{examId}` and sealing `{ keys, negativePenalty, passMarks }` into an AES-256-GCM envelope on `/api/exam/keys`. Candidate submission routes through `/api/exam/submit`, which unseals, scores, applies negative marking, and returns a signed receipt (`resultSignature`).

---

## 4. Offline Storage, Cloud Sync & CMS Governance

- **Offline Application Sync (`src/lib/offlineApplicationStore.ts`):** Indexed local queue tracks `syncStatus` (`Draft`, `Pending Sync`, `Syncing`, `Synced`, `Sync Failed`, `Requires Review`), retries automatically on the browser `online` event, and bidirectionally synchronizes with Firestore `offline_applications`.
- **CMS Sync Reporting (`src/services/cmsService.ts`, `src/context/CMSContext.tsx`, `src/components/cms/CMSControlCenter.tsx`):** Surface-level Firestore permission or connectivity errors propagate immediately to a dismissible warning banner in the Website Control Center instead of silently failing.

---

## 5. PWA & Build Hardening (`vite.config.ts`)

- Configured `VitePWA` (`registerType: 'autoUpdate'`) with Workbox caching for static assets (`js`, `css`, `html`, `png`, `jpg`, `svg`, `woff2`), explicit `NetworkOnly` rules for `/api/*`, `googleapis.com`, `firebaseio.com`, and Google OAuth handlers so authenticated API calls and tokens are never served stale from cache.
- Route-level `React.lazy` + `<Suspense>` code splitting in `src/App.tsx` reduces initial JavaScript payload size.
- Design system standardized on Navy (`#002147`) and Gold (`#C5A059`) with `Plus Jakarta Sans`, `Montserrat`, and `Hind Siliguri` typography and tabular numeric formatting.
