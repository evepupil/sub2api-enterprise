/**
 * 周期配额的开始时间在「datetime-local 输入框的值」和「接口的 ISO 字符串」之间换算。
 * 输入框的值是本地时区的 `YYYY-MM-DDTHH:mm`，接口存的是 UTC ISO 串。
 */

/** 把接口返回的时间转成本地时区的输入框值；解析不了返回空串（等价于「现在」）。 */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** 把输入框值转成接口要的 ISO 串；空串或非法值返回 undefined，由服务端取当前时刻。 */
export function datetimeLocalToISO(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}
