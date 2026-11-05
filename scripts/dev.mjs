// npm run dev : lance le serveur de la plateforme (dossier server/) s'il ne tourne pas déjà, puis le site.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const serverDir = fileURLToPath(new URL('../../server/', import.meta.url))
const running = await fetch('http://localhost:4000/api/me', { method: 'POST' }).then(() => true, () => false)
const children = []
const run = (cmd, args, cwd) => {
  const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true })
  children.push(child)
  return child
}

if (running) console.log('Serveur de la plateforme déjà lancé sur le port 4000.')
else if (process.env.VITE_API_MODE !== 'demo') run('npm', ['run', 'dev'], serverDir)

const site = run('npx', ['vite', ...process.argv.slice(2)], process.cwd())
const stop = () => { children.forEach((c) => c.kill()); process.exit(0) }
site.on('exit', stop)
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
