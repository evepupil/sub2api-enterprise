/**
 * 把一段 CSV 文本存成文件下载：生成临时下载链接并点一下，浏览器就会保存。
 * 文件开头加 UTF-8 标记（BOM），Excel 直接双击打开时才不会把中文密钥名显示成乱码。
 * 只能在点击事件里调用（用到了浏览器的文档对象）。
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  // 下载已经交给浏览器，临时地址用完释放；稍等一下再放，个别浏览器点击后立刻释放会丢掉下载
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
