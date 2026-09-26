---
'tapflow': patch
---

`tapflow flow run --session` no longer tells you to find the session id in `tapflow status`, which prints none. Its help, and the error for a `--device` name that matches more than one device, now point at the MCP server's `list_devices`, the one command that lists session ids.
