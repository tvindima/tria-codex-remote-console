export function validateBearerToken(token?: string) {
  if (!token) {
    return false;
  }

  return token.length >= 16;
}
