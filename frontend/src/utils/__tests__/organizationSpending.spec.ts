import { describe, expect, it } from 'vitest'
import { previewSpendingSplit, splitSpendingAmount } from '../organizationSpending'

function sumWithoutFloatDrift(values: number[]): number {
  const units = values.reduce((total, value) => total + Math.round(value * 1e8), 0)
  return units / 1e8
}

describe('splitSpendingAmount', () => {
  it('各份之和精确等于总额', () => {
    const cases: Array<{ total: number; count: number }> = [
      { total: 100, count: 3 },
      { total: 0.1, count: 3 },
      { total: 1, count: 7 },
      { total: 0.00000002, count: 3 },
      { total: 0, count: 4 },
      { total: 12345.6789, count: 11 }
    ]

    for (const { total, count } of cases) {
      const shares = splitSpendingAmount(total, count)
      expect(shares).toHaveLength(count)
      expect(sumWithoutFloatDrift(shares)).toBe(total)
    }
  })

  it('除不尽时余数补给排在前面的份额，且各份最多相差一个最小单位', () => {
    const shares = splitSpendingAmount(0.00000002, 3)
    expect(shares).toEqual([0.00000001, 0.00000001, 0])
  })

  it('参数非法时返回空数组', () => {
    expect(splitSpendingAmount(100, 0)).toEqual([])
    expect(splitSpendingAmount(-1, 3)).toEqual([])
    expect(splitSpendingAmount(Number.NaN, 3)).toEqual([])
  })
})

describe('previewSpendingSplit', () => {
  it('按成员标识升序分配，重复选中只算一次', () => {
    const preview = previewSpendingSplit([30, 10, 20, 10], 1)
    expect(Array.from(preview.keys())).toEqual([10, 20, 30])
    expect(sumWithoutFloatDrift(Array.from(preview.values()))).toBe(1)
    expect(preview.get(10)).toBe(0.33333334)
    expect(preview.get(30)).toBe(0.33333333)
  })

  it('没有选中任何成员时返回空结果', () => {
    expect(previewSpendingSplit([], 100).size).toBe(0)
  })
})
