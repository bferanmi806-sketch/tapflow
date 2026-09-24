---
'@tapflowio/relay': patch
---

The dashboard reads every server list through one query cache. When a list cannot be loaded, it now says so and offers a retry. Before, Tokens and Team settings took a failed response for their rows and broke, and recordings showed a failure as "No recordings yet". Saving the workspace name or logo updates the sidebar without a reload, and signing out clears what was cached, so the next person to sign in never sees the last one's data. An invite or password-reset link with no token shows as expired at once, not after a blank screen.
