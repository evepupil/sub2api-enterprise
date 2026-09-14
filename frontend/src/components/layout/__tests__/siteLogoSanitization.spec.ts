import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const sidebarSource = readFileSync(resolve(dir, '../AppSidebar.vue'), 'utf8')
const homeViewSource = readFileSync(resolve(dir, '../../../views/HomeView.vue'), 'utf8')
const keyUsageViewSource = readFileSync(resolve(dir, '../../../views/KeyUsageView.vue'), 'utf8')
const landingChromeSource = readFileSync(
  resolve(dir, '../../../views/landing/useLandingChrome.ts'),
  'utf8'
)

// 断言取值一定包在 sanitizeUrl(...) 里，不锁死具体写法
const sanitizedLogo = /sanitizeUrl\([\s\S]{0,80}?site_logo/

describe('site_logo sanitization', () => {
  it('AppSidebar imports sanitizeUrl and applies it to siteLogo', () => {
    expect(sidebarSource).toContain("import { sanitizeUrl } from '@/utils/url'")
    expect(sidebarSource).toContain('sanitizeUrl(appStore.siteLogo')
  })

  it('HomeView applies sanitizeUrl to siteLogo', () => {
    expect(homeViewSource).toMatch(sanitizedLogo)
  })

  it('landing chrome applies sanitizeUrl to siteLogo', () => {
    expect(landingChromeSource).toContain("import { sanitizeUrl } from '@/utils/url'")
    expect(landingChromeSource).toMatch(sanitizedLogo)
  })

  it('KeyUsageView applies sanitizeUrl to siteLogo', () => {
    expect(keyUsageViewSource).toMatch(sanitizedLogo)
  })

  it('all three pass allowRelative and allowDataUrl options', () => {
    for (const src of [sidebarSource, homeViewSource, keyUsageViewSource, landingChromeSource]) {
      expect(src).toContain('allowRelative: true')
      expect(src).toContain('allowDataUrl: true')
    }
  })
})
