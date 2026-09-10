import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrganizationView from '@/views/user/OrganizationView.vue'

const {
  getCurrentOrganizationMock,
  listOrganizationInvitationsMock,
  createOrganizationInvitationMock,
  copyToClipboardMock
} = vi.hoisted(() => ({
  getCurrentOrganizationMock: vi.fn(),
  listOrganizationInvitationsMock: vi.fn(),
  createOrganizationInvitationMock: vi.fn(),
  copyToClipboardMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  createI18n: () => ({
    global: { t: (key: string) => key, locale: { value: 'en' } }
  }),
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/api/organization', () => ({
  default: {
    getCurrentOrganization: (...args: unknown[]) => getCurrentOrganizationMock(...args),
    listOrganizationInvitations: (...args: unknown[]) => listOrganizationInvitationsMock(...args),
    createOrganizationInvitation: (...args: unknown[]) => createOrganizationInvitationMock(...args)
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: vi.fn() })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard: copyToClipboardMock })
}))

function mountView() {
  return mount(OrganizationView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Icon: true
      }
    }
  })
}

describe('OrganizationView', () => {
  beforeEach(() => {
    getCurrentOrganizationMock.mockReset()
    listOrganizationInvitationsMock.mockReset()
    createOrganizationInvitationMock.mockReset()
    copyToClipboardMock.mockReset()
    getCurrentOrganizationMock.mockResolvedValue({
      id: 1,
      name: 'Example Team',
      is_owner: true,
      created_at: '2026-09-11T00:00:00Z'
    })
    listOrganizationInvitationsMock.mockResolvedValue([
      {
        id: 10,
        code: 'FIRST-CODE',
        status: 'unused',
        created_at: '2026-09-11T00:00:00Z'
      }
    ])
    createOrganizationInvitationMock.mockResolvedValue({
      id: 11,
      code: 'SECOND-CODE',
      status: 'unused',
      created_at: '2026-09-11T00:01:00Z'
    })
  })

  it('loads the owner organization and invitations', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Example Team')
    expect(wrapper.text()).toContain('FIRST-CODE')
    expect(listOrganizationInvitationsMock).toHaveBeenCalledOnce()
  })

  it('creates an invitation and prepends it to the list', async () => {
    const wrapper = mountView()
    await flushPromises()
    const button = wrapper
      .findAll('button')
      .find(candidate => candidate.text().includes('organization.createInvitation'))
    expect(button).toBeDefined()

    await button!.trigger('click')
    await flushPromises()

    expect(createOrganizationInvitationMock).toHaveBeenCalledOnce()
    expect(wrapper.text().indexOf('SECOND-CODE')).toBeLessThan(wrapper.text().indexOf('FIRST-CODE'))
  })

  it('does not load invitations for a regular member', async () => {
    getCurrentOrganizationMock.mockResolvedValueOnce({
      id: 1,
      name: 'Example Team',
      is_owner: false,
      created_at: '2026-09-11T00:00:00Z'
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Example Team')
    expect(listOrganizationInvitationsMock).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('organization.createInvitation')
  })
})
