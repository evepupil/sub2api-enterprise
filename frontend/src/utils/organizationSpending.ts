// 组织成员消费上限的前端计算。
//
// 均分规则必须和后端保持一致：金额按小数点后 8 位处理，除不尽的余数按最小单位
// 依次补给成员标识较小的人，保证各人新上限之和精确等于填写的总额。
// 这里只用于提交前的预览，最终结果以服务端返回为准。

const SCALE = 8
const SCALE_FACTOR = 10n ** BigInt(SCALE)

/** 把金额转成以 1e-8 为单位的整数，避免浮点数累加误差。 */
function toUnits(amount: number): bigint {
  const fixed = Math.abs(amount).toFixed(SCALE)
  const [integerPart, fractionPart] = fixed.split('.')
  const units = BigInt(integerPart) * SCALE_FACTOR + BigInt(fractionPart)
  return amount < 0 ? -units : units
}

/** 把以 1e-8 为单位的整数转回金额。 */
function fromUnits(units: bigint): number {
  const negative = units < 0n
  const absolute = negative ? -units : units
  const integerPart = absolute / SCALE_FACTOR
  const fractionPart = (absolute % SCALE_FACTOR).toString().padStart(SCALE, '0')
  return Number(`${negative ? '-' : ''}${integerPart}.${fractionPart}`)
}

/** 把 total 均分成 count 份；参数非法时返回空数组。 */
export function splitSpendingAmount(total: number, count: number): number[] {
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(count) || count <= 0) {
    return []
  }
  const units = toUnits(total)
  const divisor = BigInt(count)
  const base = units / divisor
  const extra = units % divisor

  const shares: number[] = []
  for (let index = 0; index < count; index++) {
    shares.push(fromUnits(BigInt(index) < extra ? base + 1n : base))
  }
  return shares
}

/** 按成员标识升序给出每个人将拿到的新上限，和服务端的分配顺序一致。 */
export function previewSpendingSplit(userIds: number[], total: number): Map<number, number> {
  const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))).sort(
    (left, right) => left - right
  )
  const shares = splitSpendingAmount(total, uniqueIds.length)
  const preview = new Map<number, number>()
  uniqueIds.forEach((userId, index) => {
    preview.set(userId, shares[index] ?? 0)
  })
  return preview
}
