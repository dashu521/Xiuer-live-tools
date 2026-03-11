import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

console.log('process.cwd():', process.cwd())

const pkgPath = join(process.cwd(), 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const deps = pkg.dependencies || {}
const devDeps = pkg.devDependencies || {}

const names = [
  'playwright',
  'playwright-extra',
  'playwright-extra-plugin-stealth',
  'puppeteer-extra-plugin-stealth',
]

console.log('\npackage.json:')
for (const name of names) {
  const inDeps = name in deps
  const inDevDeps = name in devDeps
  console.log(`  ${name}: dependencies=${inDeps}, devDependencies=${inDevDeps}`)
}

function runNpmLs(pkgName) {
  console.log(`\nnpm ls ${pkgName} --prod --depth=0:`)
  try {
    const out = execSync(`npm ls ${pkgName} --prod --depth=0`, {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    console.log(out)
  } catch (e) {
    console.log(e.stdout?.toString() || '')
    console.log(e.stderr?.toString() || '')
  }
}

runNpmLs('playwright-extra')
runNpmLs('playwright')
