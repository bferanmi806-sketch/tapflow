---
'@tapflowio/relay': patch
---

The setup page no longer shows its form to a browser that cannot create the first account. Only the relay host may create it, so opening a new relay from another machine showed the form and refused it only after the email and both passwords had been typed in. Such a browser now sees the instruction instead: run `tapflow admin init` on the relay host, or, for the Docker image, set `TAPFLOW_ADMIN_EMAIL` and `TAPFLOW_ADMIN_PASSWORD`. `GET /api/v1/auth/status` reports this as `canInitialize`, decided by the same check `POST /api/v1/auth/init` enforces, so the two cannot disagree; the refusal on submit stays as it was.
