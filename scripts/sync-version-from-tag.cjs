const fs = require('fs')

const tag = process.env.GITHUB_REF_NAME || ''
const version = tag.startsWith('v') ? tag.slice(1) : tag

if (!/^\d+\.\d+\.\d+([-.].+)?$/.test(version)) {
  console.error(`FATAL: invalid tag version: ${tag}`)
  process.exit(1)
}

const packageJsonPath = 'package.json'
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
pkg.version = version
fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log(`package.json version => ${version}`)
