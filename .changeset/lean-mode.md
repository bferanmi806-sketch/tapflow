---
'tapflow': minor
'@tapflowio/relay': minor
'@tapflowio/agent-core': minor
'@tapflowio/ios-agent': minor
---

Lean mode for iOS simulators. With `agent.lean: true` in `tapflow.config.json` (or `TAPFLOW_LEAN=on`), the agent turns off a fixed list of background services — Siri and Apple Intelligence background work, iCloud Keychain and backup, Health app and HomeKit, photo analysis, Screen Time, iMessage and FaceTime, Continuity, telemetry and similar — on each simulator it boots, and puts them back when it shuts the simulator down. Measured on iOS 27, a simulator uses about a quarter less memory. Wallpaper, widgets and the services apps commonly call (push, StoreKit, CloudKit, HealthKit, the photo picker, universal links and others) stay on; an app that needs one on the list should run with Lean mode off. `tapflow init` asks on a Mac (default off) and `tapflow doctor ios` reports it. iOS 18.5 or later; Android emulators are not covered yet.
