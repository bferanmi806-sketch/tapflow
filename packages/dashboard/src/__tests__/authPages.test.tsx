// What the four auth pages do with the relay's answers, pinned before they move from an effect to
// TanStack Query (#845). Every case here must hold on both sides of that move, so the harness wraps
// each page in a QueryClientProvider even while nothing reads from it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

import { Login } from '@/src/pages/Login'
import { Setup } from '@/src/pages/Setup'
import { Invite } from '@/src/pages/Invite'
import { ResetPassword } from '@/src/pages/ResetPassword'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
/** Past the answer's handling, so "did not redirect" means never, not "not yet". */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

function renderAt(entry: string, path: string, page: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={path} element={page} />
          <Route path="/setup" element={path === '/setup' ? page : <div>setup page</div>} />
          <Route path="/login" element={path === '/login' ? page : <div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

let fetchMock: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => vi.restoreAllMocks())

describe('Login', () => {
  it('sends a relay nobody has set up to /setup', async () => {
    fetchMock.mockResolvedValue(json({ initialized: false }))
    renderAt('/login', '/login', <Login />)
    expect(await screen.findByText('setup page')).toBeInTheDocument()
  })

  it('stays on the form for an initialised relay', async () => {
    fetchMock.mockResolvedValue(json({ initialized: true }))
    renderAt('/login', '/login', <Login />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/status'))
    await settle()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.queryByText('setup page')).toBeNull()
  })

  it('stays on the form when the status check fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    renderAt('/login', '/login', <Login />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await settle()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByText('setup page')).toBeNull()
  })
})

describe('Setup', () => {
  it('sends an initialised relay to /login', async () => {
    fetchMock.mockResolvedValue(json({ initialized: true }))
    renderAt('/setup', '/setup', <Setup />)
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('stays on the form when the status check fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    renderAt('/setup', '/setup', <Setup />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await settle()
    expect(screen.getByLabelText(/admin email/i)).toBeInTheDocument()
    expect(screen.queryByText('login page')).toBeNull()
  })
})

describe('Invite', () => {
  it('says the link is invalid when it carries no token, without asking the relay', async () => {
    renderAt('/invite', '/invite', <Invite />)
    expect(await screen.findByText('Invitation expired')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the form, with the role, for a token the relay accepts', async () => {
    fetchMock.mockResolvedValue(json({ role: 'member' }))
    renderAt('/invite?token=abc', '/invite', <Invite />)
    expect(await screen.findByText('Set up your account')).toBeInTheDocument()
    expect(screen.getByText('member')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/invitations/verify?token=abc')
  })

  it('says the link is invalid when the relay refuses the token', async () => {
    fetchMock.mockResolvedValue(json({ error: 'expired' }, 410))
    renderAt('/invite?token=abc', '/invite', <Invite />)
    expect(await screen.findByText('Invitation expired')).toBeInTheDocument()
  })

  it('says the link is invalid when the check cannot reach the relay', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    renderAt('/invite?token=abc', '/invite', <Invite />)
    expect(await screen.findByText('Invitation expired')).toBeInTheDocument()
  })
})

describe('ResetPassword', () => {
  it('says the link is invalid when it carries no token, without asking the relay', async () => {
    renderAt('/reset-password', '/reset-password', <ResetPassword />)
    expect(await screen.findByText('Link expired')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the form for a token the relay accepts', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }))
    renderAt('/reset-password?token=abc', '/reset-password', <ResetPassword />)
    expect(await screen.findByText('Reset password')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/reset-password/verify?token=abc')
  })

  it('says the link is invalid when the relay refuses the token', async () => {
    fetchMock.mockResolvedValue(json({ error: 'expired' }, 410))
    renderAt('/reset-password?token=abc', '/reset-password', <ResetPassword />)
    expect(await screen.findByText('Link expired')).toBeInTheDocument()
  })

  it('says the link is invalid when the check cannot reach the relay', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    renderAt('/reset-password?token=abc', '/reset-password', <ResetPassword />)
    expect(await screen.findByText('Link expired')).toBeInTheDocument()
  })
})
