import { zodResolver } from '@hookform/resolvers/zod'
import { signupFormSchema, signupSchema } from '@haregi/schema'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

import { AreaSelect } from './area-select.tsx'
import { FormError } from './form-error.tsx'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export type SignupValues = z.infer<typeof signupSchema>
type SignupFormValues = z.infer<typeof signupFormSchema>

type SignupFormProps = {
  /** 確認用パスワードを除いた、サーバーへ送る値を受け取る。 */
  onSubmit: (values: SignupValues) => void | Promise<void>
  isSubmitting?: boolean
  errorMessage?: string | undefined
}

export function SignupForm({
  onSubmit,
  isSubmitting = false,
  errorMessage,
}: SignupFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      passwordConfirm: '',
      areaCode: '',
    },
  })

  // 確認用パスワードは UX 用の項目でありサーバーへ送らない(specification.md §4)
  const submit = handleSubmit(({ passwordConfirm: _confirm, ...values }) =>
    onSubmit(values),
  )

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <FormError message={errorMessage} />

        <Field data-invalid={errors.name !== undefined}>
          <FieldLabel htmlFor="signup-name">ユーザー名</FieldLabel>
          <Input
            id="signup-name"
            autoComplete="nickname"
            aria-invalid={errors.name !== undefined}
            {...register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={errors.email !== undefined}>
          <FieldLabel htmlFor="signup-email">メールアドレス</FieldLabel>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email !== undefined}
            {...register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={errors.password !== undefined}>
          <FieldLabel htmlFor="signup-password">パスワード</FieldLabel>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password !== undefined}
            {...register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>

        <Field data-invalid={errors.passwordConfirm !== undefined}>
          <FieldLabel htmlFor="signup-password-confirm">
            パスワード(確認)
          </FieldLabel>
          <Input
            id="signup-password-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.passwordConfirm !== undefined}
            {...register('passwordConfirm')}
          />
          <FieldError errors={[errors.passwordConfirm]} />
        </Field>

        <Field data-invalid={errors.areaCode !== undefined}>
          <FieldLabel htmlFor="signup-area">登録地域</FieldLabel>
          <AreaSelect
            id="signup-area"
            aria-invalid={errors.areaCode !== undefined}
            {...register('areaCode')}
          />
          <FieldError errors={[errors.areaCode]} />
        </Field>

        <Button type="submit" disabled={isSubmitting}>
          登録する
        </Button>
      </FieldGroup>
    </form>
  )
}
