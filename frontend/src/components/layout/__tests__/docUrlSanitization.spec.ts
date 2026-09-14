import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const headerSource = readFileSync(resolve(dir, '../AppHeader.vue'), 'utf8')
const homeViewSource = readFileSync(resolve(dir, '../../../views/HomeView.vue'), 'utf8')
const keyUsageViewSource = readFileSync(resolve(dir, '../../../views/KeyUsageView.vue'), 'utf8')
const landingChromeSource = readFileSync(
  resolve(dir, '../../../views/landing/useLandingChrome.ts'),
  'utf8'
)

// 断言取值一定包在 sanitizeUrl(...) 里，不锁死具体写法
const sanitizedDocUrl = /sanitizeUrl\([^)]*doc_url/

describe('doc_url sanitization', () => {
  it('AppHeader imports sanitizeUrl', () => {
    expect(headerSource).toContain("import { sanitizeUrl } from '@/utils/url'")
  })

  it('AppHeader applies sanitizeUrl to docUrl', () => {
    expect(headerSource).toContain('sanitizeUrl(appStore.docUrl)')
  })

  it('HomeView imports sanitizeUrl', () => {
    expect(homeViewSource).toContain("import { sanitizeUrl } from '@/utils/url'")
  })

  it('HomeView applies sanitizeUrl to docUrl', () => {
    expect(homeViewSource).toMatch(sanitizedDocUrl)
  })

  it('landing chrome imports sanitizeUrl', () => {
    expect(landingChromeSource).toContain("import { sanitizeUrl } from '@/utils/url'")
  })

  it('landing chrome applies sanitizeUrl to docUrl', () => {
    expect(landingChromeSource).toMatch(sanitizedDocUrl)
  })

  it('KeyUsageView imports sanitizeUrl', () => {
    expect(keyUsageViewSource).toContain("import { sanitizeUrl } from '@/utils/url'")
  })

  it('KeyUsageView applies sanitizeUrl to docUrl', () => {
    expect(keyUsageViewSource).toMatch(sanitizedDocUrl)
  })
})
