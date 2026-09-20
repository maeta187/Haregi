import { APIError } from 'better-auth/api'
import { auth, authDatabase } from '../src/features/auth/infrastructure/auth.ts'
import { logger } from '../src/shared/logger.ts'

try {
  await auth.api.signUpEmail({
    body: {
      name: '管理者',
      email: 'admin@example.com',
      password: 'password123',
      areaCode: '130000',
    },
  })
  logger.info('テストユーザーを作成しました')
} catch (error) {
  if (
    error instanceof APIError &&
    error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
  ) {
    logger.info('テストユーザーは作成済みです')
  } else {
    logger.error('テストユーザーの作成に失敗しました')
    process.exitCode = 1
  }
} finally {
  await authDatabase.pool.end()
}
