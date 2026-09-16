import { describe, expect, it } from 'vitest'
import { datetimeLocalToISO, toDatetimeLocalValue } from '../quotaTime'

describe('toDatetimeLocalValue', () => {
  it('把 ISO 串转成本地时区的输入框值', () => {
    // 选一个本地时区无关的整点构造：直接用本地时间成分拼 ISO 前先取本地字段。
    const date = new Date(2026, 8, 15, 9, 30)
    expect(toDatetimeLocalValue(date.toISOString())).toBe('2026-09-15T09:30')
  })

  it('补齐月日时分的前导零', () => {
    const date = new Date(2026, 0, 5, 3, 7)
    expect(toDatetimeLocalValue(date.toISOString())).toBe('2026-01-05T03:07')
  })

  it('空值和非法值返回空串', () => {
    expect(toDatetimeLocalValue(null)).toBe('')
    expect(toDatetimeLocalValue(undefined)).toBe('')
    expect(toDatetimeLocalValue('')).toBe('')
    expect(toDatetimeLocalValue('not-a-date')).toBe('')
  })
})

describe('datetimeLocalToISO', () => {
  it('把输入框值转成 ISO 串', () => {
    const iso = datetimeLocalToISO('2026-09-15T09:30')
    expect(iso).toBe(new Date(2026, 8, 15, 9, 30).toISOString())
  })

  it('空串和纯空白返回 undefined，由服务端取当前时刻', () => {
    expect(datetimeLocalToISO('')).toBeUndefined()
    expect(datetimeLocalToISO('   ')).toBeUndefined()
  })

  it('非法值返回 undefined 而不是抛错', () => {
    expect(datetimeLocalToISO('garbage')).toBeUndefined()
  })

  it('与 toDatetimeLocalValue 互为逆运算', () => {
    const value = '2026-12-31T23:59'
    expect(toDatetimeLocalValue(datetimeLocalToISO(value))).toBe(value)
  })
})
