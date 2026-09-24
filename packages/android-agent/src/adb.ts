import { execFile } from 'child_process'
import { promisify } from 'util'
import { ValidationError } from '@tapflowio/agent-core'

const execFileAsync = promisify(execFile)

// `execFile` collects the child's stdout in memory and rejects with "stdout maxBuffer length exceeded"
// once it passes `maxBuffer`, which is 1 MiB unless set. `screencap -p` of a 1080×2424 screen with
// photos on it is larger than that, so every screenshot of such a screen failed inside the agent,
// while a flatter screen of the same size compressed under the limit and went through (#842). 64 MiB
// is what the iOS agent already gives `xcodebuild` in `XCUITreeReader`. `uiautomator dump` runs
// through `exec` and gets the same room: a large accessibility tree is the same failure one call over.
const ADB_MAXBUFFER = 64 * 1024 * 1024

function getAdbPath(): string {
  if (process.env['ADB_PATH']) return process.env['ADB_PATH']
  const androidHome = process.env['ANDROID_HOME']
  if (!androidHome) {
    throw new ValidationError(
      'ADB not found. Set ANDROID_HOME or ADB_PATH environment variable.\n' +
      'Example: export ANDROID_HOME=$HOME/Library/Android/sdk',
    )
  }
  return `${androidHome}/platform-tools/adb`
}

function getEmulatorPath(): string {
  const androidHome = process.env['ANDROID_HOME']
  if (!androidHome) {
    throw new ValidationError(
      'ANDROID_HOME not set. Install Android SDK and set the environment variable.\n' +
      'Example: export ANDROID_HOME=$HOME/Library/Android/sdk',
    )
  }
  return `${androidHome}/emulator/emulator`
}

export interface AdbRunner {
  exec(...args: string[]): Promise<string>
  execBinary(...args: string[]): Promise<Buffer>
  listAvds(): Promise<string[]>
}

export const defaultRunner: AdbRunner = {
  async exec(...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(getAdbPath(), args, { maxBuffer: ADB_MAXBUFFER })
    return stdout
  },
  async execBinary(...args: string[]): Promise<Buffer> {
    const { stdout } = await execFileAsync(getAdbPath(), args, { encoding: 'buffer', maxBuffer: ADB_MAXBUFFER })
    return stdout
  },
  async listAvds(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(getEmulatorPath(), ['-list-avds'])
      return stdout.split('\n').map((l) => l.trim()).filter(Boolean)
    } catch {
      return []
    }
  },
}
