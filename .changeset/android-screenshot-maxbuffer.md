---
'@tapflowio/android-agent': patch
---

Android screenshots of photo-heavy screens no longer fail with "stdout maxBuffer length exceeded" ([#842](https://github.com/jo-duchan/tapflow/issues/842)). The agent ran `adb exec-out screencap -p` through Node's `execFile` with its default 1 MiB stdout limit, so a 1080×2424 PNG with photos in it was rejected before it left the Mac, while a flatter screen of the same size compressed under the limit and went through. `adb` output may now be 64 MiB, the room the iOS agent already gives `xcodebuild`, for the screenshot and for the `uiautomator dump` behind the accessibility tree.
