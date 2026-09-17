import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrganizationView from '@/views/user/OrganizationView.vue'
import type { OrganizationMember } from '@/types'

const {
  getCurrentOrganizationMock,
  listOrganizationInvitationsMock,
  createOrganizationInvitationMock,
  listOrganizationMembersMock,
  updateOrganizationMemberQuotaMock,
  copyToClipboardMock
} = vi.hoisted(() => ({
  getCurrentOrganizationMock: vi.fn(),
  listOrganizationInvitationsMock: vi.fn(),
  createOrganizationInvitationMock: vi.fn(),
  listOrganizationMembersMock: vi.fn(),
  updateOrganizationMemberQuotaMock: vi.fn(),
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
    createOrganizationInvitation: (...args: unknown[]) => createOrganizationInvitationMock(...args),
    listOrganizationMembers: (...args: unknown[]) => listOrganizationMembersMock(...args),
    updateOrganizationMemberQuota: (...args: unknown[]) =>
      updateOrganizationMemberQuotaMock(...args)
  },
  getQuotaRequestPolicy: vi.fn(() =>
    Promise.resolve({ mode: 'off', min_amount: null, max_amount: null })
  ),
  listQuotaRequests: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
  updateQuotaRequestPolicy: vi.fn(),
  submitQuotaRequest: vi.fn(),
  withdrawQuotaRequest: vi.fn(),
  approveQuotaRequest: vi.fn(),
  rejectQuotaRequest: vi.fn()
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: vi.fn(), showSuccess: vi.fn() })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard: copyToClipboardMock })
}))

function buildMember(overrides: Partial<OrganizationMember> = {}): OrganizationMember {
  return {
    user_id: 2,
    email: 'alice@example.com',
    username: 'alice',
    status: 'active',
    is_owner: false,
    display_name: 'Alice',
    spending_limit: null,
    spending_used: 0,
    spending_frozen: 0,
    spending_remaining: null,
    // 默认带一份生效中的周期配额：配额弹窗打开时直接落在周期模式。
    quota: {
      mode: 'periodic_active',
      amount: 100,
      period_days: 30,
      start_at: '2026-09-01T00:00:00Z',
      window_start: '2026-09-01T00:00:00Z',
      window_end: '2026-10-01T00:00:00Z'
    },
    joined_at: '2026-09-11T00:00:00Z',
    ...overrides
  }
}

// BaseDialog 把内容 Teleport 到 body，stub 掉让弹窗内容渲染在原地，方便断言。
function mountView() {
  return mount(OrganizationView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        BaseDialog: {
          template: '<div v-if="show" class="dialog-stub"><slot /><slot name="footer" /></div>',
          props: ['show', 'title']
        },
        Icon: true
      }
    }
  })
}

async function mountWithMembers(members: OrganizationMember[]) {
  listOrganizationMembersMock.mockResolvedValue({ items: members, total: members.length })
  const wrapper = mountView()
  await flushPromises()
  return wrapper
}

async function openQuotaDialog(wrapper: ReturnType<typeof mountView>) {
  const editButton = wrapper
    .findAll('button')
    .find(button => button.text().includes('organization.quotaTitle'))
  expect(editButton).toBeDefined()
  await editButton!.trigger('click')
  await flushPromises()
  const dialog = wrapper.find('.dialog-stub')
  expect(dialog.exists()).toBe(true)
  return dialog
}

describe('OrganizationView', () => {
  beforeEach(() => {
    getCurrentOrganizationMock.mockReset()
    listOrganizationInvitationsMock.mockReset()
    createOrganizationInvitationMock.mockReset()
    listOrganizationMembersMock.mockReset()
    updateOrganizationMemberQuotaMock.mockReset()
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
    const wrapper = await mountWithMembers([])
    expect(wrapper.text()).toContain('Example Team')
    expect(wrapper.text()).toContain('FIRST-CODE')
    expect(listOrganizationInvitationsMock).toHaveBeenCalledOnce()
  })

  it('creates an invitation and prepends it to the list', async () => {
    const wrapper = await mountWithMembers([])
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
    const wrapper = await mountWithMembers([])

    expect(wrapper.text()).toContain('Example Team')
    expect(listOrganizationInvitationsMock).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('organization.createInvitation')
  })

  describe('periodic quota immediate effect', () => {
    it('defaults to immediate effect and hides the time input', async () => {
      const wrapper = await mountWithMembers([buildMember()])
      const dialog = await openQuotaDialog(wrapper)

      const checkbox = dialog.find('input[data-testid="quota-immediate"]')
      expect((checkbox.element as HTMLInputElement).checked).toBe(true)
      expect(dialog.find('input[type="datetime-local"]').exists()).toBe(false)
    })

    it('saves without start_at when immediate', async () => {
      updateOrganizationMemberQuotaMock.mockResolvedValue(buildMember())
      const wrapper = await mountWithMembers([buildMember()])
      const dialog = await openQuotaDialog(wrapper)

      const numberInputs = dialog.findAll('input[type="number"]')
      await numberInputs[0].setValue('20')
      await numberInputs[1].setValue('30')

      const saveButton = dialog
        .findAll('button')
        .find(button => button.text().includes('common.save'))
      await saveButton!.trigger('click')
      await flushPromises()

      expect(updateOrganizationMemberQuotaMock).toHaveBeenCalledOnce()
      const payload = updateOrganizationMemberQuotaMock.mock.calls[0][1] as Record<string, unknown>
      expect(payload.amount).toBe(20)
      expect(payload.period_days).toBe(30)
      expect(payload.start_at).toBeUndefined()
    })

    it('requires a time when scheduling and sends it after picking one', async () => {
      updateOrganizationMemberQuotaMock.mockResolvedValue(buildMember())
      const wrapper = await mountWithMembers([buildMember()])
      const dialog = await openQuotaDialog(wrapper)

      const checkbox = dialog.find('input[data-testid="quota-immediate"]')
      await checkbox.setValue(false)
      expect(dialog.find('input[type="datetime-local"]').exists()).toBe(true)

      const saveButton = dialog
        .findAll('button')
        .find(button => button.text().includes('common.save'))
      await saveButton!.trigger('click')
      await flushPromises()
      expect(dialog.text()).toContain('organization.quotaStartTimeRequired')
      expect(updateOrganizationMemberQuotaMock).not.toHaveBeenCalled()

      await dialog.find('input[type="datetime-local"]').setValue('2026-10-01T09:00')
      await saveButton!.trigger('click')
      await flushPromises()

      expect(updateOrganizationMemberQuotaMock).toHaveBeenCalledOnce()
      const payload = updateOrganizationMemberQuotaMock.mock.calls[0][1] as Record<string, unknown>
      expect(payload.start_at).toBe(new Date('2026-10-01T09:00').toISOString())
    })
  })
})
