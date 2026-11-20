import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { handleWclRequest } from './server/wclProxy'

// Em dev, serve /api/wcl com a mesma lógica da função Netlify (lê .env).
function wclDevProxy(env: Record<string, string>): Plugin {
  return {
    name: 'wcl-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/wcl', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const r = await handleWclRequest(req.method ?? 'GET', Buffer.concat(chunks).toString(), env)
        res.statusCode = r.status
        res.setHeader('Content-Type', 'application/json')
        res.end(await r.text())
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // sem filtro de prefixo: só usado no servidor de dev
  return {
    plugins: [react(), wclDevProxy(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
