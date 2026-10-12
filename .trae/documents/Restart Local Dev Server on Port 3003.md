## Goal
- Bring the Next.js app back up on `http://localhost:3003` and verify it serves `/dashboard`.

## Steps
- Check running process on 3003 and clear conflicts if needed:
  - Windows: `netstat -ano | findstr :3003` then `taskkill /PID <pid> /F` if a stray process is holding the port.
- Start the dev server in `proctorless-app` on port 3003:
  - `npm install` (if deps changed)
  - Prefer CLI flag: `npm run dev -- -p 3003`
  - Alternative: set env var: `$env:PORT=3003; npm run dev`
- Verify locally:
  - Open `http://localhost:3003/` and `http://localhost:3003/dashboard`
  - Confirm role-based dashboard loads and auth redirects via middleware.
- Extension sanity check (optional):
  - With the extension loaded, ensure it hits `http://localhost:3003/api/integrity/tab` after arming and tab switches.

## Contingencies
- If port 3003 remains busy, pick `3002` temporarily: `npm run dev -- -p 3002` and update extension `API_BASE_URL` accordingly.
- If Next.js refuses the flag, use `npx next dev -p 3003` to force the port.

Approve and I will execute these steps to bring the server back on 3003 and validate it end-to-end.