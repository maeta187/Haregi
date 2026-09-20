export type AuthUser = {
  id: string
  name: string
  email: string
  areaCode: string
}

export interface SessionReader {
  getSession(input: { headers: Headers }): Promise<{ user: AuthUser } | null>
}
