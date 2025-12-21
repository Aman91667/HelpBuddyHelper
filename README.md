# helpers (frontend) — developer guide

This README describes what was implemented in the helpers frontend during the recent iteration, how it connects to the backend, where accepted rides appear, the OTP + timer behavior, and troubleshooting tips (including how socket.io events are used).

Quick start (dev)
1. Install deps and start dev server

```powershell
cd .\helpers
npm install
npm run dev
```

2. Where accepted rides appear in the UI
- Dashboard (incoming requests): helpers see `RequestCard` components with Accept and Decline actions. The accept action navigates to the Job page.
- Job page (`/job/:id`): canonical place for an accepted request. It shows the job details, OTP card (when required), map, and action button(s) to mark arrival/start/complete.
- CurrentJobCard: compact UI used on dashboard/tracking that shows the active/accepted job and relevant actions.

OTP and timer behavior (what the frontend does)
- When a helper accepts and is assigned a service, the server sets `status = ACCEPTED`.
- Before marking arrival, helper must verify the OTP from the patient. The Job page shows an OTP input when `service.status === 'ACCEPTED' && !service.otpVerified`.
- On successful verify (POST `/api/services/:id/verify-otp`):
  - Server sets `otpVerified = true` and records `startedAt = now`.
  - Frontend receives the updated service, starts a local timer synchronized to server `startedAt` and displays billing minutes computed as `ceil(elapsedMinutes * 2)`.
  - The helper then calls `arrive` to transition to STARTED.

- When the helper completes the job (POST `/api/services/:id/complete`):
  - Backend computes `billedMinutes = ceil(elapsedMinutes * 2)` and `fare = 15 + billedMinutes * 2.5` and stores them.
  - Frontend stops the timer and displays the final fare returned by the server.

Socket.IO (how the frontend listens & reacts)
- The helpers app connects to Socket.IO at app start (socket client located in `helpers/src/lib/socketClient.ts`). It listens to these events:
  - `service:request` — incoming job request from a patient (payload contains `service` object and `expiresInMs`). Show an incoming request card and start a local countdown using `expiresInMs`.
  - `service:accepted` — patient was notified that a helper accepted (for the patient). Helpers don't typically receive this for their own accept.
  - `service:cancelled` — service was canceled (navigate away or hide card).
  - `service:updated` — server-sent update for the service object (update UI state).

- When a helper accepts or declines a request the client either calls an HTTP endpoint (accept/decline) or emits a socket event. The backend supports both; prefer HTTP endpoints for status transitions that require DB validation (arrive/complete/verify-otp) and socket emits for quick realtime notifications.

Developer tips & common gotchas
- If `service:request` never arrives on helpers: ensure helpers are connected (check console logs for successful socket connect) and that `RealtimeService.findNearbyHelpers` can find them (helper must have currentLat/currentLng set). Check backend logs for `notifyHelpers` output.
- OTP verify errors: verify helper identity (JWT token) — the helper verifying OTP must be the assigned helper. Check the `/api/services/:id/verify-otp` response and backend logs for details.
- Client-side: the helper frontend `apiClient` has client-side cooldowns for sensitive endpoints (e.g., `/services/active`) — if you see `Client-side cooldown` messages wait for cooldown to expire or reduce polling.

Where to look in the code
- Request card and dashboard: `helpers/src/helper/pages/DashboardPage.tsx` and `helpers/src/helper/components/RequestCard.tsx`
- Job page (OTP + timer UI): `helpers/src/features/jobs/jobPage.tsx`
- API wrapper (calls to backend endpoints): `helpers/src/lib/apiClient.ts`
- Socket client: `helpers/src/lib/socketClient.ts` or `helpers/src/core/api/socketClient.ts` depending on the branch — search for `socketClient.connect` and `on('service:request'` to find the exact file.

Testing checklist (manual)
1. Run backend & frontend.
2. Create a service as a patient (use patient app or Postman). Ensure server emits `service:request` and helper sees it.
3. Helper accepts and is navigated to `/job/:id`.
4. Helper enters OTP and calls verify; UI should start the timer and allow arrival.
5. Let some time elapse, then complete the job. Confirm the final fare and billedMinutes are shown.

If you want, I can add a script to the frontend to simulate socket events (helpful for UI development without a live backend).

---
If you want I will also add a short `TESTING.md` with step-by-step Postman requests and expected responses to make E2E testing trivial.
      reactDom.configs.recommended,
