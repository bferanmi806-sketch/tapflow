import { useQuery } from '@tanstack/react-query'
import { getMe, queryKeys } from '@/lib/queries'

export interface AuthUser {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

/**
 * The signed-in user, read once for the layout, the sidebar and settings alike — each used to fetch
 * `/auth/me` on its own (#845).
 *
 * **No redirect here.** `DashboardLayout` renders `<Navigate to="/login">` when `user` is null, which
 * made the `navigate` this hook used to call a duplicate. **Loading until an answer**, as before: a
 * relay that cannot be reached leaves the page blank rather than sending a signed-in person to log in.
 */
export function useAuth(): AuthState {
  const me = useQuery({ queryKey: queryKeys.me, queryFn: getMe })
  return { user: me.data ?? null, loading: !me.isSuccess }
}
