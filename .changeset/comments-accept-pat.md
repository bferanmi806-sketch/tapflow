---
'@tapflowio/relay': patch
---

`POST /api/v1/comments` accepts a personal access token with the `builds:write` scope, as `POST /api/v1/builds` does. The CI recipe in the Build Distribution guide uploads a build with a PAT and then posts the branch and commit as a comment with the same PAT, but the comment route accepted only the dashboard cookie, so that step got a 401 and, under `curl -sf`, failed the job. A PAT without `builds:write` gets a 403; the dashboard cookie works as before.

A comment on a build that does not exist now gets a 404. It used to fail the database's foreign-key check inside an asynchronous callback, where nothing caught the error, and a relay started with the `tapflow` CLI exited on it. The comment's `author` in the response also falls back to the email's local part when the user has no display name, as the comment list already did.
