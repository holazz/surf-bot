import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import c from 'picocolors'

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const COMMANDS_DIR = join(ROOT_DIR, 'src/commands')

async function updateScripts(scripts) {
  const packageJsonPath = join(ROOT_DIR, 'package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  const merged = { ...packageJson.scripts, ...scripts }
  const keys = Object.keys(merged)
  const [dev, special, rest] = [
    keys.includes('dev') ? ['dev'] : [],
    keys.filter(k => ['cmd', 'postinstall', 'lint'].includes(k)),
    keys.filter(k => k !== 'dev' && !['cmd', 'postinstall', 'lint'].includes(k)),
  ]
  packageJson.scripts = [...dev, ...rest, ...special].reduce((acc, k) => {
    acc[k] = merged[k]
    return acc
  }, {})
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
  console.log(c.green(`Updated: ${relative(ROOT_DIR, packageJsonPath)}`))
}

async function run() {
  const commandNames = process.argv.slice(2)

  if (commandNames.length === 0) {
    console.log(c.red('No command names provided.'))
    process.exit(0)
  }

  await Promise.all(
    commandNames.map(async (name) => {
      const filepath = join(COMMANDS_DIR, `${name}.ts`)
      try {
        await access(filepath)
      }
      catch {
        await mkdir(COMMANDS_DIR, { recursive: true })
        const content = `import { run } from '../modules/${name}'\n\nrun()\n`
        await writeFile(filepath, content)
        console.log(c.green(`Created: ${relative(ROOT_DIR, filepath)}`))
      }
    }),
  )

  const scripts = Object.fromEntries(commandNames.map(name => [name, `tsx src/commands/${name}.ts`]))
  await updateScripts(scripts)
}

run()
