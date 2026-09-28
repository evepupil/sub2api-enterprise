/**
 * 把文本转成可安全放进网页内容的形式：& < > " ' 替换为实体。
 * 用于以网页内容渲染的图表提示框等处，名称可能来自成员自填的姓名、模型或接口名。
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
