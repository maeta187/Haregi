import { z } from 'zod'

import { findArea } from './areas.ts'

const emailSchema = z.string().email('メールアドレスの形式が正しくありません')
const passwordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .max(20, 'パスワードは20文字以内で入力してください')
  .regex(/[a-z]/, 'パスワードには小文字の英字を含めてください')
  .regex(/\d/, 'パスワードには数字を含めてください')

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'ユーザー名を入力してください')
    .max(20, 'ユーザー名は20文字以内で入力してください'),
  email: emailSchema,
  password: passwordSchema,
  areaCode: z
    .string()
    .refine(
      (areaCode) => findArea(areaCode) !== undefined,
      '登録地域を選択してください',
    ),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'パスワードを入力してください'),
})
