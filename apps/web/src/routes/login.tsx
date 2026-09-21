import { createFileRoute, Link } from '@tanstack/react-router'

import { LoginForm } from '@/features/auth/components/login-form.tsx'
import { useLogin } from '@/features/auth/hooks/use-login.ts'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const login = useLogin()

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="font-heading mb-6 text-2xl font-semibold">ログイン</h1>

      <LoginForm
        onSubmit={(values) => login.mutate(values)}
        isSubmitting={login.isPending}
        errorMessage={login.error?.message}
      />

      <p className="text-muted-foreground mt-6 text-sm">
        アカウントをお持ちでないですか?{' '}
        <Link to="/signup" className="text-foreground underline">
          新規登録
        </Link>
      </p>
    </main>
  )
}
