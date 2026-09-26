---
'@tapflowio/relay': patch
---

`POST /api/v1/comments` accepts a personal access token with the `builds:write` scope, as `POST /api/v1/builds` does. The CI recipe in the Build Distribution guide uploads a build with a PAT and then posts the branch and commit as a comment with the same PAT, but the comment route accepted only the dashboard cookie, so that step got a 401 and, under `curl -sf`, failed the job. A PAT without `builds:write` gets a 403; the dashboard cookie works as before.
