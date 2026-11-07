const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', 'dist')
// 默认 10087：Taro 的 `dev:h5` 开发服务器会占用 10086，
// 两个命令分开使用，避免端口冲突破坏排查。
const port = Number(process.env.PORT) || 10087
const indexFile = path.join(root, 'index.html')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
}

// 构建产物缺失时直接给出可执行的提示，避免浏览器里只看到 "Not found"
if (!fs.existsSync(indexFile)) {
  console.error(`[serve] ${root} 中没有 index.html，请先执行 npm run build:h5`)
  console.error('[serve] 注意：npm run dev:h5 运行期间会清空 dist/，不能与 npm run serve:h5 同时使用')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '')
  const file = path.resolve(root, rel)
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' })
    res.end(data)
  })
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[serve] 端口 ${port} 已被占用，可用 PORT=10088 npm run serve:h5 换一个端口`)
  } else {
    console.error('[serve] 启动失败:', err)
  }
  process.exit(1)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`极速简历 H5（生产构建）: http://127.0.0.1:${port}/`)
})
