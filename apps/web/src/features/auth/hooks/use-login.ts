import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { signIn } from '../api/auth-api.ts'

/** ログインのユースケース。成功したらメイン画面へ送る。 */
export function useLogin() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signIn,
    onSuccess: async () => {
      toast.success('ログインしました')
      await navigate({ to: '/forecast' })
    },
  })
}
