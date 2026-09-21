import { useSessionStore } from '../api/auth-api.ts'

/** ログイン状態の出し分けに使うセッション。 */
export function useSession() {
  const { data, isPending } = useSessionStore()

  return {
    user: data?.user ?? null,
    isPending,
  }
}
