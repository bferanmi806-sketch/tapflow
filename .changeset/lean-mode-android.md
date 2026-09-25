---
'@tapflowio/android-agent': minor
'tapflow': minor
---

Lean mode on Android emulators. With `agent.lean` on, the agent keeps four bundled Google apps disabled — the Google app, YouTube, YouTube Music and Digital Wellbeing — which start on their own at boot. Measured on an API 34 emulator, the guest takes about 350 MB, just under a fifth, less of the Mac's memory. The emulator returns memory only when it exits, so the apps stay disabled while Lean mode is on, and the saving starts from an emulator's second boot through tapflow; turning Lean mode off brings them back at the next boot. Photos, Messages, Gmail and Maps stay on because apps open images, texts, mail and maps through them. An emulator that is already running when a session asks for it is left as it is. `tapflow init` now asks wherever adb is installed, and `tapflow doctor` shows the setting per platform.
