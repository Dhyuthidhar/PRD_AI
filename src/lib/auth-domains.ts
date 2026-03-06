// Email domain allowlisting for user registration

export const ALLOWED_REGISTRATION_DOMAINS = [
  'surviant.in',
  'surviantllc.com',
  'surviant.com',
] as const

export function isAllowedRegistrationEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const parts = normalized.split('@')
  
  // Must have exactly one @ symbol
  if (parts.length !== 2) return false
  
  const domain = parts[1]
  
  // Domain must be exactly one of the allowed domains
  return ALLOWED_REGISTRATION_DOMAINS.includes(domain as any)
}

export function getAllowedDomainsText(): string {
  return ALLOWED_REGISTRATION_DOMAINS
    .map(domain => `@${domain}`)
    .join(', ')
}