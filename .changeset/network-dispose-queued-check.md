---
'@tapflowio/ios-agent': patch
---

<!-- changelog: internal — fixes a test-teardown race (#826). The product half, a queued liveness check that no longer runs after dispose, changes nothing observable: disconnect queues forget() for every device, which rewrites the same rule, and the enforcement-lost report it drops had no sessions left to reach. -->

A liveness check queued before `SimulatorNetwork.dispose()` no longer runs, and `idle()` waits for queued work to settle ([#826](https://github.com/jo-duchan/tapflow/issues/826)).
