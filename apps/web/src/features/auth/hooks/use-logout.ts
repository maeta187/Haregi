import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { signOut } from '../api/auth-api.ts'

/** ログアウトのユースケース。 */
export function useLogout() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      toast.success('ログアウトしました')
      await navigate({ to: '/' })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
