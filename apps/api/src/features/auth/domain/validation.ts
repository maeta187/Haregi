import { signupSchema, passwordCharactersSchema } from '@haregi/schema'

const authSignupSchema = signupSchema.extend({
  password: passwordCharactersSchema,
})

export const validateSignup = (input: unknown) =>
  authSignupSchema.safeParse(input)

const updateUserSchema = signupSchema
  .pick({ name: true, areaCode: true })
  .partial()
export const validateUpdateUser = (input: unknown) =>
  updateUserSchema.safeParse(input)

export const validateChangePassword = (password: unknown) =>
  passwordCharactersSchema.safeParse(password)
