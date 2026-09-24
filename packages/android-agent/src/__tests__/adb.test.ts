import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execFile } from 'child_process'

// The runner is the one seam between the agent and `adb`, so it is driven against a fake `execFile`
// and needs no SDK or emulator. `promisify(execFile)` in `adb.ts` sees a plain `vi.fn()` with no
// `promisify.custom`, so it appends the node callback and resolves with that callback's second
// argument — which is why the fake answers `{ stdout }`, the shape the helpers destructure.
vi.mock('child_process', () => ({ execFile: vi.fn() }))

import { defaultRunner } from '../adb'

type ExecFileCallback = (error: Error | null, result: { stdout: string | Buffer }) => void

// Options are always passed by the runner, so the callback is the fourth argument here, not the
// third as in tests whose production call omits them.
function answer(stdout: string | Buffer) {
  return (_file: unknown, _args: unknown, _options: unknown, cb: ExecFileCallback) => {
    cb(null, { stdout })
    return {} as ReturnType<typeof execFile>
  }
}

function lastCall(): unknown[] {
  const calls = vi.mocked(execFile).mock.calls as unknown as unknown[][]
  return calls.at(-1) ?? []
}

describe('defaultRunner', () => {
  beforeEach(() => {
    vi.stubEnv('ADB_PATH', '/fake/adb')
    vi.mocked(execFile).mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  // #842: `screencap -p` of a photo-heavy 1080×2424 screen is over 1 MiB, and `execFile` without
  // `maxBuffer` rejects with "stdout maxBuffer length exceeded" at exactly that size. The literal is
  // asserted rather than a constant imported from the module, so that dropping the option — or
  // lowering it back toward Node's default — fails here instead of on the next photo-heavy screen.
  it('execBinary gives adb 64 MiB of stdout and keeps the buffer encoding', async () => {
    vi.mocked(execFile).mockImplementation(answer(Buffer.from('png')) as never)

    const out = await defaultRunner.execBinary('-s', 'emulator-5554', 'exec-out', 'screencap', '-p')

    expect(out).toEqual(Buffer.from('png'))
    expect(lastCall()[0]).toBe('/fake/adb')
    expect(lastCall()[1]).toEqual(['-s', 'emulator-5554', 'exec-out', 'screencap', '-p'])
    expect(lastCall()[2]).toEqual({ encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  })

  it('exec gives adb the same room, for the uiautomator dump behind the accessibility tree', async () => {
    vi.mocked(execFile).mockImplementation(answer('<hierarchy/>') as never)

    const out = await defaultRunner.exec('-s', 'emulator-5554', 'exec-out', 'uiautomator', 'dump', '/dev/tty')

    expect(out).toBe('<hierarchy/>')
    expect(lastCall()[1]).toEqual(['-s', 'emulator-5554', 'exec-out', 'uiautomator', 'dump', '/dev/tty'])
    expect(lastCall()[2]).toEqual({ maxBuffer: 64 * 1024 * 1024 })
  })
})
