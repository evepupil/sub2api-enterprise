/** 语言路由之外的兜底 404（正常访问不会走到这里）。 */
export default function RootNotFound() {
  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem', textAlign: 'center' }}>
        <h1>404</h1>
        <p>
          <a href="/">返回首页</a>
        </p>
      </body>
    </html>
  );
}
