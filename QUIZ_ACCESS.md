# Exclusive quiz access

Accounts may have multiple login sessions. Each in-progress submission has one browser-window lease, bound to a random window token and the authenticated login session. The server stores only the token hash.

The quiz page claims access before loading answers and renews it every 20 seconds. A lease expires after 90 seconds without renewal. A heartbeat or write cannot revive an expired lease. Another window can then claim access and load the saved answers. The old window must reopen the quiz; it cannot upload stale answers after takeover.

Closing, reloading, or leaving the quiz stops heartbeats. There is deliberately no unload-dependent release: an abrupt disconnect behaves the same way. Reopening or changing browsers may require waiting up to 90 seconds. Quiz deadlines and duration limits continue during that wait.

Answer writes, final submission, activity logs, and student deletion routes validate the lease while holding the submission row lock. Their database operations use the same transaction, so takeover cannot interleave with an authorized write. Starting an attempt locks the student row and reuses any in-progress attempt to prevent simultaneous starts from bypassing the lease.

## Rollout

1. Apply `20260912000000_add_quiz_attempt_lease` using `npm run prisma:deploy` in the backend environment.
2. Generate the Prisma client with `npm run prisma:generate` and deploy the backend and frontend together, outside an active quiz session. Older quiz pages do not send the required lease header and must be refreshed.
3. Test with two separate browser profiles signed into the same student account: both may log in, but only one may open an attempt for answering.
4. Close the owning quiz page, wait 90 seconds, and retry in the other browser. Confirm the saved answers resume. Confirm a stale browser cannot save answers or activity logs.

Automated tests use mocked database transactions. The real MySQL concurrency and two-browser checks should be performed in the target test environment before classroom use.
