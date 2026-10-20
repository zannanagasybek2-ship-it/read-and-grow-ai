# Read and Grow AI

A Grade 9 reading classroom prepared for GitHub and Vercel. Start with **START_HERE_KZ.txt** for the Kazakh deployment guide.

## Features

- Supervisor signs in using a private four-digit PIN; students use a classroom QR, nickname and class.
- Twenty English educational retellings, six reading pages each, twenty vocabulary items per story, interactive practice, XP and awards.
- Shared progress, supervisor feedback, CSV reports and protected audio/video submissions.
- Story editor and supervisor-only shared publication.

## Setup

1. Create a Supabase project and execute `supabase/setup.sql` in its SQL Editor.
2. Upload this folder's contents to the root of a GitHub repository.
3. Import the repository in Vercel, preset **Other**, build `npm run build`, output `public`, Node.js 22 or newer.
4. In Vercel server environment variables set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPERVISOR_PIN` (exactly four digits), then deploy. Optionally set a random `SESSION_SECRET` of at least 32 characters. Never commit real keys or PINs.
5. Open the public deployment URL, select Supervisor, enter the PIN, and select **Show classroom QR**. Students scan the QR, which contains the classroom code but never the supervisor PIN.

No build dependencies are needed. `npm test` runs backend integration tests using an in-memory database adapter; `npm run test:ui` exercises UI functions against a DOM mock. `npm run build` produces the static `public` folder. Tests do not provision or verify a live Supabase/Vercel account and are not browser visual tests.

## Data and permissions

Vercel serverless API functions use a server-only Supabase service-role key. SQL enables RLS, denies browser roles, and restricts progress/feedback/rate-limit RPCs to the service role. Students cannot query the database directly. Signed HttpOnly, Secure, SameSite=Lax cookies separate supervisor and reader sessions. PIN attempts are rate limited by IP and globally; a four-digit PIN has limited entropy and is suitable only for this small reading project. Do not use it as protection for highly sensitive records.

Student identity belongs to the browser cookie. Clearing cookies or changing devices requires joining again; there is no email-based account recovery. A reading passport JSON backup can transfer learning progress, but not ownership of previous media submissions or the old roster identity. Written feedback and media metadata are preserved server-side during progress updates. Practice scores are student-submitted and are not secure examination grades.

Uploads go directly to a private Supabase Storage bucket using a signed URL; the API checks ownership, file metadata and size before linking them to a story. Download links expire after 120 seconds. Recordings are visible to their student and the supervisor. No live AI service, chatbot or automatic video assessment is included. Educational retellings are not full original editions. Data is not migrated automatically from earlier LAN/HTML versions.

## Deployment checks

After deployment, test with a second device: QR join, complete a task, sync, refresh the supervisor roster, save feedback, and upload/play one short recording. Only after that invite the class. The application caps the classroom at 200 students and 50 linked recordings, with 20 MiB per recording. Provider quotas and pricing remain separate; no unlimited free hosting/storage promise is made.

## Primary technical references

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/functions/limitations
- https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- https://supabase.com/docs/guides/database/postgres/row-level-security
