export interface OrganizationRegistrationContext {
  organizationName: string
  invitationCode: string
}

const STORAGE_KEY = 'organization_registration_context'

export function storeOrganizationRegistrationContext(context: OrganizationRegistrationContext): void {
  const normalized: OrganizationRegistrationContext = {
    organizationName: context.organizationName.trim(),
    invitationCode: context.invitationCode.trim()
  }
  if (!normalized.organizationName && !normalized.invitationCode) {
    clearOrganizationRegistrationContext()
    return
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
}

export function loadOrganizationRegistrationContext(): OrganizationRegistrationContext {
  const fallback: OrganizationRegistrationContext = { organizationName: '', invitationCode: '' }
  if (typeof window === 'undefined') return fallback
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as Partial<OrganizationRegistrationContext>
    return {
      organizationName: typeof parsed.organizationName === 'string' ? parsed.organizationName.trim() : '',
      invitationCode: typeof parsed.invitationCode === 'string' ? parsed.invitationCode.trim() : ''
    }
  } catch {
    return fallback
  }
}

export function clearOrganizationRegistrationContext(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(STORAGE_KEY)
  }
}
