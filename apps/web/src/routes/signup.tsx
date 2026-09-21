import { createFileRoute, Link } from '@tanstack/react-router'

import { SignupForm } from '@/features/auth/components/signup-form.tsx'
import { useSignup } from '@/features/auth/hooks/use-signup.ts'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const signup = useSignup()

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="font-heading mb-1 text-2xl font-semibold">新規登録</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        登録地域の週間予報を見ながら、その日のコーデを記録できます。
      </p>

      <SignupForm
        onSubmit={(values) => signup.mutate(values)}
        isSubmitting={signup.isPending}
        errorMessage={signup.error?.message}
      />

      <p className="text-muted-foreground mt-6 text-sm">
        アカウントをお持ちですか?{' '}
        <Link to="/login" className="text-foreground underline">
          ログイン
        </Link>
      </p>
    </main>
  )
}
