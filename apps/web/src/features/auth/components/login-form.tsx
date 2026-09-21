import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@haregi/schema'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

import { FormError } from './form-error.tsx'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export type LoginValues = z.infer<typeof loginSchema>

type LoginFormProps = {
  onSubmit: (values: LoginValues) => void | Promise<void>
  isSubmitting?: boolean
  errorMessage?: string | undefined
}

export function LoginForm({
  onSubmit,
  isSubmitting = false,
  errorMessage,
}: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} noValidate>
      <FieldGroup>
        <FormError message={errorMessage} />

        <Field data-invalid={errors.email !== undefined}>
          <FieldLabel htmlFor="login-email">メールアドレス</FieldLabel>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email !== undefined}
            {...register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={errors.password !== undefined}>
          <FieldLabel htmlFor="login-password">パスワード</FieldLabel>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password !== undefined}
            {...register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>

        <Button type="submit" disabled={isSubmitting}>
          ログイン
        </Button>
      </FieldGroup>
    </form>
  )
}
