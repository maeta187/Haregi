import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { signUp } from '../api/auth-api.ts'

/** 会員登録のユースケース。成功したらメイン画面へ送る。 */
export function useSignup() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signUp,
    onSuccess: async () => {
      toast.success('アカウントを作成しました')
      await navigate({ to: '/forecast' })
    },
  })
}
