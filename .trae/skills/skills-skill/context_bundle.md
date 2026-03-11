[35m项目结构 (全在线递归扫描)[0m
```
[dir] .github
[dir] .github/ISSUE_TEMPLATE
[dir] .github/workflows
[dir] .husky
[dir] bin
[dir] scripts
[dir] skills
[dir] skills/find-skills
[dir] src
[dir] src/prompts
[dir] src/providers
[dir] tests
[file] .github/RELEASE_TEMPLATE.md
[file] .gitignore
[file] .husky/pre-commit
[file] .prettierrc
[file] AGENTS.md
[file] README.md
[file] ThirdPartyNoticeText.txt
[file] bin/cli.mjs
[file] build.config.mjs
[file] package.json
[file] pnpm-lock.yaml
[file] scripts/execute-tests.ts
[file] scripts/generate-licenses.ts
[file] scripts/sync-agents.ts
[file] scripts/validate-agents.ts
[file] src/add-prompt.test.ts
[file] src/add.test.ts
[file] src/add.ts
[file] src/agents.ts
[file] src/cli.test.ts
[file] src/cli.ts
[file] src/constants.ts
[file] src/find.ts
[file] src/git.ts
[file] src/init.test.ts
[file] src/install.ts
[file] src/installer.ts
[file] src/list.test.ts
[file] src/list.ts
[file] src/local-lock.ts
[file] src/plugin-manifest.ts
[file] src/remove.test.ts
[file] src/remove.ts
[file] src/skill-lock.ts
[file] src/skills.ts
[file] src/source-parser.test.ts
[file] src/source-parser.ts
[file] src/sync.ts
[file] src/telemetry.ts
[file] src/test-utils.ts
[file] src/types.ts
[file] tests/cross-platform-paths.test.ts
[file] tests/dist.test.ts
[file] tests/full-depth-discovery.test.ts
[file] tests/installer-symlink.test.ts
[file] tests/list-installed.test.ts
[file] tests/local-lock.test.ts
[file] tests/openclaw-paths.test.ts
[file] tests/plugin-grouping.test.ts
[file] tests/plugin-manifest-discovery.test.ts
[file] tests/remove-canonical.test.ts
[file] tests/sanitize-name.test.ts
[file] tests/skill-matching.test.ts
[file] tests/skill-path.test.ts
[file] tests/source-parser.test.ts
[file] tests/subpath-traversal.test.ts
[file] tests/sync.test.ts
[file] tests/wellknown-provider.test.ts
[file] tests/xdg-config-paths.test.ts
[file] tsconfig.json
```

[35m主要语言: [0mNode.js

[35m关键文档内容[0m

[35m文件: README.md[0m
# skills

The CLI for the open agent skills ecosystem.

<!-- agent-list:start -->
Supports **OpenCode**, **Claude Code**, **Codex**, **Cursor**, and [37 more](#available-agents).
<!-- agent-list:end -->

## Install a Skill

```bash
npx skills add vercel-labs/agent-skills
```

### Source Formats

```bash
# GitHub shorthand (owner/repo)
npx skills add vercel-labs/agent-skills

# Full GitHub URL
npx skills add https://github.com/vercel-labs/agent-skills

# Direct path to a skill in a repo
npx skills add https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines

# GitLab URL
npx skills add https://gitlab.com/org/repo

# Any git URL
npx skills add git@github.com:vercel-labs/agent-skills.git

# Local path
npx skills add ./my-local-skills
```

### Options

| Option                    | Description                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-g, --global`            | Install to user directory instead of project                                                                                                       |
| `-a, --agent <agents...>` | <!-- agent-names:start -->Target specific agents (e.g., `claude-code`, `codex`). See [Available Agents](#available-agents)<!-- agent-names:end -->                  |
| `-s, --skill <skills...>` | Install specific skills by name (use `'*'` for all skills)                                                                                         |
| `-l, --list`              | List available skills without installing                                                                                                           |
| `--copy`                  | Copy files instead of symlinking to agent directories                                                                                              |
| `-y, --yes`               | Skip all confirmation prompts                                                                                                                      |
| `--all`                   | Install all skills to all agents without prompts                                                                                                   |

### Examples

```bash
# List skills in a repository
npx skills add vercel-labs/agent-skills --list

# Install specific skills
npx skills add vercel-labs/agent-skills --skill frontend-design --skill skill-creator

# Install a skill with spaces in the name (must be quoted)
npx skills add owner/repo --skill "Convex Best Practices"

# Install to specific agents
npx skills add vercel-labs/agent-skills -a claude-code -a opencode

# Non-interactive installation (CI/CD friendly)
npx skills add vercel-labs/agent-skills --skill frontend-design -g -a claude-code -y

# Install all skills from a repo to all agents
npx skills add vercel-labs/agent-skills --all

# Install all skills to specific agents
npx skills add vercel-labs/agent-skills --skill '*' -a claude-code

# Install specific skills to all agents
npx skills add vercel-labs/agent-skills --agent '*' --skill frontend-design
```

### Installation Scope

| Scope       | Flag      | Location            | Use Case                                      |
| ----------- | --------- | ------------------- | --------------------------------------------- |
| **Project** | (default) | `./<agent>/skills/` | Committed with your project, shared with team |
| **Global**  | `-g`      | `~/<agent>/skills/` | Available across all projects                 |

### Installation Methods

When installing interactively, you can choose:

| Method                    | Description                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Symlink** (Recommended) | Creates symlinks from each agent to a canonical copy. Single source of truth, easy updates. |
| **Copy**                  | Creates independent copies for each agent. Use when symlinks aren't supported.              |

## Other Commands

| Command                      | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `npx skills list`            | List installed skills (alias: `ls`)            |
| `npx skills find [query]`    | Search for skills interactively or by keyword  |
| `npx skills remove [skills]` | Remove installed skills from agents            |
| `npx skills check`           | Check for available skill updates              |
| `npx skills update`          | Update all installed skills to latest versions |
| `npx skills init [name]`     | Create a new SKILL.md template                 |

### `skills list`

List all installed skills. Similar to `npm ls`.

```bash
# List all installed skills (project and global)
npx skills list

# List only global skills
npx skills ls -g

# Filter by specific agents
npx skills ls -a claude-code -a cursor
```

### `skills find`

Search for skills interactively or by keyword.

```bash
# Interactive search (fzf-style)
npx skills find

# Search by keyword
npx skills find typescript
```

### `skills check` / `skills update`

```bash
# Check if any installed skills have updates
npx skills check

# Update all skills to latest versions
npx skills update
```

### `skills init`

```bash
# Create SKILL.md in current directory
npx skills init

# Create a new skill in a subdirectory
npx skills init my-skill
```

### `skills remove`

Remove installed skills from agents.

```bash
# Remove interactively (select from installed skills)
npx skills remove

# Remove specific skill by name
npx skills remove web-design-guidelines

# Remove multiple skills
npx skills remove frontend-design web-design-guidelines

# Remove from global scope
npx skills remove --global web-design-guidelines

# Remove from specific agents only
npx skills remove --agent claude-code cursor my-skill

# Remove all installed skills without confirmation
npx skills remove --all

# Remove all skills from a specific agent
npx skills remove --skill '*' -a cursor

# Remove a specific skill from all agents
npx skills remove my-skill --agent '*'

# Use 'rm' alias
npx skills rm my-skill
```

| Option         | Description                                      |
| -------------- | ------------------------------------------------ |
| `-g, --global` | Remove from global scope (~/) instead of project |
| `-a, --agent`  | Remove from specific agents (use `'*'` for all)  |
| `-s, --skill`  | Specify skills to remove (use `'*'` for all)     |
| `-y, --yes`    | Skip confirmation prompts                        |
| `--all`        | Shorthand for `--skill '*' --agent '*' -y`       |

## What are Agent Skills?

Agent skills are reusable instruction sets that extend your coding agent's capabilities. They're defined in `SKILL.md`
files with YAML frontmatter containing a `name` and `description`.

Skills let agents perform specialized tasks like:

- Generating release notes from git history
- Creating PRs following your team's conventions
- Integrating with external tools (Linear, Notion, etc.)

Discover skills at **[skills.sh](https://skills.sh)**

## Supported Agents

Skills can be installed to any of these agents:

<!-- supported-agents:start -->
| Agent | `--agent` | Project Path | Global Path |
|-------|-----------|--------------|-------------|
| Amp, Kimi Code CLI, Replit, Universal | `amp`, `kimi-cli`, `replit`, `universal` | `.agents/skills/` | `~/.config/agents/skills/` |
| Antigravity | `antigravity` | `.agent/skills/` | `~/.gemini/antigravity/skills/` |
| Augment | `augment` | `.augment/skills/` | `~/.augment/skills/` |
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` |
| OpenClaw | `openclaw` | `skills/` | `~/.openclaw/skills/` |
| Cline | `cline` | `.agents/skills/` | `~/.agents/skills/` |
| CodeBuddy | `codebuddy` | `.codebuddy/skills/` | `~/.codebuddy/skills/` |
| Codex | `codex` | `.agents/skills/` | `~/.codex/skills/` |
| Command Code | `command-code` | `.commandcode/skills/` | `~/.commandcode/skills/` |
| Continue | `continue` | `.continue/skills/` | `~/.continue/skills/` |
| Cortex Code | `cortex` | `.cortex/skills/` | `~/.snowflake/cortex/skills/` |
| Crush | `crush` | `.crush/skills/` | `~/.config/crush/skills/` |
| Cursor | `cursor` | `.agents/skills/` | `~/.cursor/skills/` |
| Droid | `droid` | `.factory/skills/` | `~/.factory/skills/` |
| Gemini CLI | `gemini-cli` | `.agents/skills/` | `~/.gemini/skills/` |
| GitHub Copilot | `github-copilot` | `.agents/skills/` | `~/.copilot/skills/` |
| Goose | `goose` | `.goose/skills/` | `~/.config/goose/skills/` |
| Junie | `junie` | `.junie/skills/` | `~/.junie/skills/` |
| iFlow CLI | `iflow-cli` | `.iflow/skills/` | `~/.iflow/skills/` |
| Kilo Code | `kilo` | `.kilocode/skills/` | `~/.kilocode/skills/` |
| Kiro CLI | `kiro-cli` | `.kiro/skills/` | `~/.kiro/skills/` |
| Kode | `kode` | `.kode/skills/` | `~/.kode/skills/` |
| MCPJam | `mcpjam` | `.mcpjam/skills/` | `~/.mcpjam/skills/` |
| Mistral Vibe | `mistral-vibe` | `.vibe/skills/` | `~/.vibe/skills/` |
| Mux | `mux` | `.mux/skills/` | `~/.mux/skills/` |
| OpenCode | `opencode` | `.agents/skills/` | `~/.config/opencode/skills/` |
| OpenHands | `openhands` | `.openhands/skills/` | `~/.openhands/skills/` |
| Pi | `pi` | `.pi/skills/` | `~/.pi/agent/skills/` |
| Qoder | `qoder` | `.qoder/skills/` | `~/.qoder/skills/` |
| Qwen Code | `qwen-code` | `.qwen/skills/` | `~/.qwen/skills/` |
| Roo Code | `roo` | `.roo/skills/` | `~/.roo/skills/` |
| Trae | `trae` | `.trae/skills/` | `~/.trae/skills/` |
| Trae CN | `trae-cn` | `.trae/skills/` | `~/.trae-cn/skills/` |
| Windsurf | `windsurf` | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |
| Zencoder | `zencoder` | `.zencoder/skills/` | `~/.zencoder/skills/` |
| Neovate | `neovate` | `.neovate/skills/` | `~/.neovate/skills/` |
| Pochi | `pochi` | `.pochi/skills/` | `~/.pochi/skills/` |
| AdaL | `adal` | `.adal/skills/` | `~/.adal/skills/` |
<!-- supported-agents:end -->

> [!NOTE]
> **Kiro CLI users:** After installing skills, manually add them to your custom agent's `resources` in
> `.kiro/agents/<agent>.json`:
>
> ```json
> {
>   "resources": ["skill://.kiro/skills/**/SKILL.md"]
> }
> ```

The CLI automatically detects which coding agents you have installed. If none are detected, you'll be prompted to select
which agents to install to.

## Creating Skills

Skills are directories containing a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: my-skill
description: What this skill does and when to use it
---

# My Skill

Instructions for the agent to follow when this skill is activated.

## When to Use

Describe the scenarios where this skill should be used.

## Steps

1. First, do this
2. Then, do that
```

### Required Fields

- `name`: Unique identifier (lowercase, hyphens allowed)
- `description`: Brief explanation of what the skill does

### Optional Fields

- `metadata.internal`: Set to `true` to hide the skill from normal discovery. Internal skills are only visible and
  installable when `INSTALL_INTERNAL_SKILLS=1` is set. Useful for work-in-progress skills or skills meant only for
  internal tooling.

```markdown
---
name: my-internal-skill
description: An internal skill not shown by default
metadata:
  internal: true
---
```

### Skill Discovery

The CLI searches for skills in these locations within a repository:

<!-- skill-discovery:start -->
- Root directory (if it contains `SKILL.md`)
- `skills/`
- `skills/.curated/`
- `skills/.experimental/`
- `skills/.system/`
- `.agents/skills/`
- `.agent/skills/`
- `.augment/skills/`
- `.claude/skills/`
- `./skills/`
- `.codebuddy/skills/`
- `.commandcode/skills/`
- `.continue/skills/`
- `.cortex/skills/`
- `.crush/skills/`
- `.factory/skills/`
- `.goose/skills/`
- `.junie/skills/`
- `.iflow/skills/`
- `.kilocode/skills/`
- `.kiro/skills/`
- `.kode/skills/`
- `.mcpjam/skills/`
- `.vibe/skills/`
- `.mux/skills/`
- `.openhands/skills/`
- `.pi/skills/`
- `.qoder/skills/`
- `.qwen/skills/`
- `.roo/skills/`
- `.trae/skills/`
- `.windsurf/skills/`
- `.zencoder/skills/`
- `.neovate/skills/`
- `.pochi/skills/`
- `.adal/skills/`
<!-- skill-discovery:end -->

### Plugin Manifest Discovery

If `.claude-plugin/marketplace.json` or `.claude-plugin/plugin.json` exists, skills declared in those files are also discovered:

```json
// .claude-plugin/marketplace.json
{
  "metadata": { "pluginRoot": "./plugins" },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "my-plugin",
      "skills": ["./skills/review", "./skills/test"]
    }
  ]
}
```

This enables compatibility with the [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) ecosystem.

If no skills are found in standard locations, a recursive search is performed.

## Compatibility

Skills are generally compatible across agents since they follow a
shared [Agent Skills specification](https://agentskills.io). However, some features may be agent-specific:

| Feature         | OpenCode | OpenHands | Claude Code | Cline | CodeBuddy | Codex | Command Code | Kiro CLI | Cursor | Antigravity | Roo Code | Github Copilot | Amp | OpenClaw | Neovate | Pi  | Qoder | Zencoder |
| --------------- | -------- | --------- | ----------- | ----- | --------- | ----- | ------------ | -------- | ------ | ----------- | -------- | -------------- | --- | -------- | ------- | --- | ----- | -------- |
| Basic skills    | Yes      | Yes       | Yes         | Yes   | Yes       | Yes   | Yes          | Yes      | Yes    | Yes         | Yes      | Yes            | Yes | Yes      | Yes     | Yes | Yes   | Yes      |
| `allowed-tools` | Yes      | Yes       | Yes         | Yes   | Yes       | Yes   | Yes          | No       | Yes    | Yes         | Yes      | Yes            | Yes | Yes      | Yes     | Yes | Yes   | No       |
| `context: fork` | No       | No        | Yes         | No    | No        | No    | No           | No       | No     | No          | No       | No             | No  | No       | No      | No  | No    | No       |
| Hooks           | No       | No        | Yes         | Yes   | No        | No    | No           | No       | No     | No          | No       | No             | No  | No       | No      | No  | No    | No       |

## Troubleshooting

### "No skills found"

Ensure the repository contains valid `SKILL.md` files with both `name` and `description` in the frontmatter.

### Skill not loading in agent

- Verify the skill was installed to the correct path
- Check the agent's documentation for skill loading requirements
- Ensure the `SKILL.md` frontmatter is valid YAML

### Permission errors

Ensure you have write access to the target directory.

## Environment Variables

| Variable                  | Description                                                                |
| ------------------------- | -------------------------------------------------------------------------- |
| `INSTALL_INTERNAL_SKILLS` | Set to `1` or `true` to show and install skills marked as `internal: true` |
| `DISABLE_TELEMETRY`       | Set to disable anonymous usage telemetry                                   |
| `DO_NOT_TRACK`            | Alternative way to disable telemetry                                       |

```bash
# Install internal skills
INSTALL_INTERNAL_SKILLS=1 npx skills add vercel-labs/agent-skills --list
```

## Telemetry

This CLI collects anonymous usage data to help improve the tool. No personal information is collected.

Telemetry is automatically disabled in CI environments.

## Related Links

- [Agent Skills Specification](https://agentskills.io)
- [Skills Directory](https://skills.sh)
- [Amp Skills Documentation](https://ampcode.com/manual#agent-skills)
- [Antigravity Skills Documentation](https://antigravity.google/docs/skills)
- [Factory AI / Droid Skills Documentation](https://docs.factory.ai/cli/configuration/skills)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [OpenClaw Skills Documentation](https://docs.openclaw.ai/tools/skills)
- [Cline Skills Documentation](https://docs.cline.bot/features/skills)
- [CodeBuddy Skills Documentation](https://www.codebuddy.ai/docs/ide/Features/Skills)
- [Codex Skills Documentation](https://developers.openai.com/codex/skills)
- [Command Code Skills Documentation](https://commandcode.ai/docs/skills)
- [Crush Skills Documentation](https://github.com/charmbracelet/crush?tab=readme-ov-file#agent-skills)
- [Cursor Skills Documentation](https://cursor.com/docs/context/skills)
- [Gemini CLI Skills Documentation](https://geminicli.com/docs/cli/skills/)
- [GitHub Copilot Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
- [iFlow CLI Skills Documentation](https://platform.iflow.cn/en/cli/examples/skill)
- [Kimi Code CLI Skills Documentation](https://moonshotai.github.io/kimi-cli/en/customization/skills.html)
- [Kiro CLI Skills Documentation](https://kiro.dev/docs/cli/custom-agents/configuration-reference/#skill-resources)
- [Kode Skills Documentation](https://github.com/shareAI-lab/kode/blob/main/docs/skills.md)
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills)
- [Qwen Code Skills Documentation](https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/)
- [OpenHands Skills Documentation](https://docs.openhands.ai/modules/usage/how-to/using-skills)
- [Pi Skills Documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md)
- [Qoder Skills Documentation](https://docs.qoder.com/cli/Skills)
- [Replit Skills Documentation](https://docs.replit.com/replitai/skills)
- [Roo Code Skills Documentation](https://docs.roocode.com/features/skills)
- [Trae Skills Documentation](https://docs.trae.ai/ide/skills)
- [Vercel Agent Skills Repository](https://github.com/vercel-labs/agent-skills)

## License

MIT


------------------------------------------------------------


[35m核心代码预览 (Top 100 Lines)[0m

[35m文件: scripts/execute-tests.ts[0m
```ts
#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type RunOptions = {
  rootDir: string;
  testsDir: string;
  filter?: RegExp;
  listOnly: boolean;
};

function parseArgs(argv: string[], rootDir: string): RunOptions {
  const testsDir = path.join(rootDir, 'tests');
  let filter: RegExp | undefined;
  let listOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list' || arg === '-l') {
      listOnly = true;
      continue;
    }
    if (arg === '--filter' || arg === '-f') {
      const pattern = argv[i + 1];
      if (!pattern) throw new Error('Missing value for --filter');
      filter = new RegExp(pattern);
      i++;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(
        `Usage: node scripts/execute-tests.ts [options]\n\nOptions:\n  -l, --list              List discovered test files and exit\n  -f, --filter <regex>    Only run tests whose path matches regex\n  -h, --help              Show help\n`
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { rootDir, testsDir, filter, listOnly };
}

async function findTestFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findTestFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function runOneTest(rootDir: string, testFile: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn('node', [testFile], {
      cwd: rootDir,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, '..');
  const opts = parseArgs(process.argv.slice(2), rootDir);

  let testFiles: string[];
  try {
    testFiles = await findTestFiles(opts.testsDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.exit(1);
  }

  if (opts.filter) {
    testFiles = testFiles.filter((f) => opts.filter!.test(f));
  }

  if (testFiles.length === 0) {
    process.exit(1);
  }

  if (opts.listOnly) {
    for (const file of testFiles) console.log(path.relative(opts.rootDir, file));
    return;
  }
```


[35m文件: scripts/generate-licenses.ts[0m
```ts
#!/usr/bin/env node
/**
 * Generates ThirdPartyNoticeText.txt for bundled dependencies.
 * Run during build to ensure license compliance.
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Dependencies that get bundled into the CLI
const BUNDLED_PACKAGES = [
  '@clack/prompts',
  '@clack/core',
  'picocolors',
  'gray-matter',
  'simple-git',
  'xdg-basedir',
  'sisteransi',
  'is-unicode-supported',
];

interface LicenseInfo {
  licenses: string;
  repository?: string;
  publisher?: string;
  licenseFile?: string;
}

function getLicenseText(pkgPath: string): string {
  const possibleFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md'];
  for (const file of possibleFiles) {
    const filePath = join(pkgPath, file);
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8').trim();
    }
  }
  return '';
}

function main() {
  console.log('Generating ThirdPartyNoticeText.txt...');

  // Get license info from license-checker
  const output = execSync('npx license-checker --json', { encoding: 'utf-8' });
  const allLicenses: Record<string, LicenseInfo> = JSON.parse(output);

  const lines: string[] = [
    '/*!----------------- Skills CLI ThirdPartyNotices -------------------------------------------------------',
    '',
    'The Skills CLI incorporates third party material from the projects listed below.',
    'The original copyright notice and the license under which this material was received',
    'are set forth below. These licenses and notices are provided for informational purposes only.',
    '',
    '---------------------------------------------',
    'Third Party Code Components',
    '--------------------------------------------',
    '',
  ];

  for (const [pkgNameVersion, info] of Object.entries(allLicenses)) {
    // Extract package name (remove version)
    const pkgName = pkgNameVersion.replace(/@[\d.]+(-.*)?$/, '').replace(/^(.+)@.*$/, '$1');

    // Check if this is a bundled package
    const isBundled = BUNDLED_PACKAGES.some(
      (bundled) => pkgName === bundled || pkgNameVersion.startsWith(bundled + '@')
    );

    if (!isBundled) continue;

    // Get the actual license text from the package
    const pkgPath = join(process.cwd(), 'node_modules', pkgName);
    const licenseText = getLicenseText(pkgPath);

    lines.push('='.repeat(80));
    lines.push(`Package: ${pkgNameVersion}`);
    lines.push(`License: ${info.licenses}`);
    if (info.repository) {
      lines.push(`Repository: ${info.repository}`);
    }
    lines.push('-'.repeat(80));
    lines.push('');
    if (licenseText) {
      lines.push(licenseText);
    } else {
      // Fallback to generic MIT/ISC text
      if (info.licenses === 'MIT') {
        lines.push('MIT License');
        lines.push('');
        lines.push('Permission is hereby granted, free of charge, to any person obtaining a copy');
        lines.push('of this software and associated documentation files (the "Software"), to deal');
        lines.push('in the Software without restriction, including without limitation the rights');
        lines.push('to use, copy, modify, merge, publish, distribute, sublicense, and/or sell');
        lines.push('copies of the Software, and to permit persons to whom the Software is');
        lines.push('furnished to do so, subject to the following conditions:');
        lines.push('');
        lines.push(
          'The above copyright notice and this permission notice shall be included in all'
        );
```


[35m文件: scripts/sync-agents.ts[0m
```ts
#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { agents } from '../src/agents.ts';

const ROOT = join(import.meta.dirname, '..');
const README_PATH = join(ROOT, 'README.md');
const PACKAGE_PATH = join(ROOT, 'package.json');

function generateAgentList(): string {
  const agentList = Object.values(agents);
  const count = agentList.length;
  return `Supports **OpenCode**, **Claude Code**, **Codex**, **Cursor**, and [${count - 4} more](#available-agents).`;
}

function generateAgentNames(): string {
  return 'Target specific agents (e.g., `claude-code`, `codex`). See [Available Agents](#available-agents)';
}

function generateAvailableAgentsTable(): string {
  // Group agents by their paths
  const pathGroups = new Map<
    string,
    {
      keys: string[];
      displayNames: string[];
      skillsDir: string;
      globalSkillsDir: string | undefined;
    }
  >();

  for (const [key, a] of Object.entries(agents)) {
    const pathKey = `${a.skillsDir}|${a.globalSkillsDir}`;
    if (!pathGroups.has(pathKey)) {
      pathGroups.set(pathKey, {
        keys: [],
        displayNames: [],
        skillsDir: a.skillsDir,
        globalSkillsDir: a.globalSkillsDir,
      });
    }
    const group = pathGroups.get(pathKey)!;
    group.keys.push(key);
    group.displayNames.push(a.displayName);
  }

  const rows = Array.from(pathGroups.values()).map((group) => {
    const globalPath = group.globalSkillsDir
      ? `\`${group.globalSkillsDir.replace(homedir(), '~')}/\``
      : 'N/A (project-only)';
    const names = group.displayNames.join(', ');
    const keys = group.keys.map((k) => `\`${k}\``).join(', ');
    return `| ${names} | ${keys} | \`${group.skillsDir}/\` | ${globalPath} |`;
  });
  return [
    '| Agent | `--agent` | Project Path | Global Path |',
    '|-------|-----------|--------------|-------------|',
    ...rows,
  ].join('\n');
}

function generateSkillDiscoveryPaths(): string {
  const standardPaths = [
    '- Root directory (if it contains `SKILL.md`)',
    '- `skills/`',
    '- `skills/.curated/`',
    '- `skills/.experimental/`',
    '- `skills/.system/`',
  ];

  const agentPaths = [...new Set(Object.values(agents).map((a) => a.skillsDir))].map(
    (p) => `- \`.${p.startsWith('.') ? p.slice(1) : '/' + p}/\``
  );

  return [...standardPaths, ...agentPaths].join('\n');
}

function generateKeywords(): string[] {
  const baseKeywords = ['cli', 'agent-skills', 'skills', 'ai-agents'];
  const agentKeywords = Object.keys(agents);
  return [...baseKeywords, ...agentKeywords];
}

function replaceSection(
  content: string,
  marker: string,
  replacement: string,
  inline = false
): string {
  const regex = new RegExp(`(<!-- ${marker}:start -->)[\\s\\S]*?(<!-- ${marker}:end -->)`, 'g');
  if (inline) {
    return content.replace(regex, `$1${replacement}$2`);
  }
  return content.replace(regex, `$1\n${replacement}\n$2`);
}

function main() {
  let readme = readFileSync(README_PATH, 'utf-8');
```


[35m文件: scripts/validate-agents.ts[0m
```ts
#!/usr/bin/env node

import { homedir } from 'os';
import { agents } from '../src/agents.ts';

let hasErrors = false;

function error(message: string) {
  console.error(message);
  hasErrors = true;
}

/**
 * Checks for duplicate `displayName` values among the agents.
 *
 * Iterates through the `agents` object, collecting all `displayName` values (case-insensitive)
 * and mapping them to their corresponding agent keys. If any `displayName` is associated with
 * more than one agent, an error is reported listing the duplicate names and their keys.
 *
 * @throws Will call the `error` function if duplicate display names are found.
 */

function checkDuplicateDisplayNames() {
  const displayNames = new Map<string, string[]>();

  for (const [key, config] of Object.entries(agents)) {
    const name = config.displayName.toLowerCase();
    if (!displayNames.has(name)) {
      displayNames.set(name, []);
    }
    displayNames.get(name)!.push(key);
  }

  for (const [name, keys] of displayNames) {
    if (keys.length > 1) {
      error(`Duplicate displayName "${name}" found in agents: ${keys.join(', ')}`);
    }
  }
}

/**
 * Checks for duplicate `skillsDir` and `globalSkillsDir` values among agents.
 *
 * Iterates through the `agents` object, collecting all `skillsDir` and normalized `globalSkillsDir`
 * paths. If any directory is associated with more than one agent, an error is reported listing the
 * conflicting agents.
 *
 * @remarks
 * - The `globalSkillsDir` path is normalized by replacing the user's home directory with `~`.
 * - Errors are reported using the `error` function.
 *
 * @throws Will call `error` if duplicate directories are found.
 */

function checkDuplicateSkillsDirs() {
  const skillsDirs = new Map<string, string[]>();
  const globalSkillsDirs = new Map<string, string[]>();

  for (const [key, config] of Object.entries(agents)) {
    if (!skillsDirs.has(config.skillsDir)) {
      skillsDirs.set(config.skillsDir, []);
    }
    skillsDirs.get(config.skillsDir)!.push(key);

    const globalPath = config.globalSkillsDir.replace(homedir(), '~');
    if (!globalSkillsDirs.has(globalPath)) {
      globalSkillsDirs.set(globalPath, []);
    }
    globalSkillsDirs.get(globalPath)!.push(key);
  }

  for (const [dir, keys] of skillsDirs) {
    if (keys.length > 1) {
      error(`Duplicate skillsDir "${dir}" found in agents: ${keys.join(', ')}`);
    }
  }

  for (const [dir, keys] of globalSkillsDirs) {
    if (keys.length > 1) {
      error(`Duplicate globalSkillsDir "${dir}" found in agents: ${keys.join(', ')}`);
    }
  }
}

console.log('Validating agents...\n');

checkDuplicateDisplayNames();
// It's fine to have duplicate skills dirs
// checkDuplicateSkillsDirs();

if (hasErrors) {
  console.log('\nValidation failed.');
  process.exit(1);
} else {
  console.log('All agents valid.');
}
```


[35m文件: src/add-prompt.test.ts[0m
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promptForAgents } from './add.js';
import * as skillLock from './skill-lock.js';
import * as searchMultiselectModule from './prompts/search-multiselect.js';

// Mock dependencies
vi.mock('./skill-lock.js');
vi.mock('./prompts/search-multiselect.js');
vi.mock('./telemetry.js', () => ({
  setVersion: vi.fn(),
  track: vi.fn(),
}));
vi.mock('../package.json', () => ({
  default: { version: '1.0.0' },
}));

describe('promptForAgents', () => {
  // Cast to any to avoid AgentType validation in tests
  const choices: any[] = [
    { value: 'opencode', label: 'OpenCode' },
    { value: 'cursor', label: 'Cursor' },
    { value: 'claude-code', label: 'Claude Code' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use default agents (claude-code, opencode, codex) when no history exists', async () => {
    vi.mocked(skillLock.getLastSelectedAgents).mockResolvedValue(undefined);
    vi.mocked(searchMultiselectModule.searchMultiselect).mockResolvedValue(['opencode']);

    await promptForAgents('Select agents', choices);

    // Should default to claude-code, opencode, codex (filtered by available choices)
    expect(searchMultiselectModule.searchMultiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSelected: ['claude-code', 'opencode'],
      })
    );
  });

  it('should use last selected agents when history exists', async () => {
    vi.mocked(skillLock.getLastSelectedAgents).mockResolvedValue(['cursor']);
    vi.mocked(searchMultiselectModule.searchMultiselect).mockResolvedValue(['cursor']);

    await promptForAgents('Select agents', choices);

    expect(searchMultiselectModule.searchMultiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSelected: ['cursor'],
      })
    );
  });

  it('should filter out invalid agents from history', async () => {
    vi.mocked(skillLock.getLastSelectedAgents).mockResolvedValue(['cursor', 'invalid-agent']);
    vi.mocked(searchMultiselectModule.searchMultiselect).mockResolvedValue(['cursor']);

    await promptForAgents('Select agents', choices);

    expect(searchMultiselectModule.searchMultiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSelected: ['cursor'],
      })
    );
  });

  it('should use default agents if all history agents are invalid', async () => {
    vi.mocked(skillLock.getLastSelectedAgents).mockResolvedValue(['invalid-agent']);
    vi.mocked(searchMultiselectModule.searchMultiselect).mockResolvedValue(['opencode']);

    await promptForAgents('Select agents', choices);

    // When history is invalid, should fall back to defaults (claude-code, opencode, codex)
    // filtered by available choices
    expect(searchMultiselectModule.searchMultiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSelected: ['claude-code', 'opencode'],
      })
    );
  });

  it('should save selected agents if not cancelled', async () => {
    vi.mocked(skillLock.getLastSelectedAgents).mockResolvedValue(undefined);
    vi.mocked(searchMultiselectModule.searchMultiselect).mockResolvedValue(['opencode']);

    await promptForAgents('Select agents', choices);

    expect(skillLock.saveSelectedAgents).toHaveBeenCalledWith(['opencode']);
  });

  it('should not save agents if cancelled', async () => {
    vi.mocked(skillLock.getLastSelectedAgents).mockResolvedValue(undefined);
    vi.mocked(searchMultiselectModule.searchMultiselect).mockResolvedValue(
      searchMultiselectModule.cancelSymbol
    );

    await promptForAgents('Select agents', choices);

```


[35m文件: src/add.test.ts[0m
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runCli } from './test-utils.ts';
import { shouldInstallInternalSkills } from './skills.ts';
import { parseAddOptions } from './add.ts';

describe('add command', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skills-add-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should show error when no source provided', () => {
    const result = runCli(['add'], testDir);
    expect(result.stdout).toContain('ERROR');
    expect(result.stdout).toContain('Missing required argument: source');
    expect(result.exitCode).toBe(1);
  });

  it('should show error for non-existent local path', () => {
    const result = runCli(['add', './non-existent-path', '-y'], testDir);
    expect(result.stdout).toContain('Local path does not exist');
    expect(result.exitCode).toBe(1);
  });

  it('should list skills from local path with --list flag', () => {
    // Create a test skill
    const skillDir = join(testDir, 'test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---
name: test-skill
description: A test skill for testing
---

# Test Skill

This is a test skill.
`
    );

    const result = runCli(['add', testDir, '--list'], testDir);
    expect(result.stdout).toContain('test-skill');
    expect(result.stdout).toContain('A test skill for testing');
    expect(result.exitCode).toBe(0);
  });

  it('should show no skills found for empty directory', () => {
    const result = runCli(['add', testDir, '-y'], testDir);
    expect(result.stdout).toContain('No skills found');
    expect(result.stdout).toContain('No valid skills found');
    expect(result.exitCode).toBe(1);
  });

  it('should install skill from local path with -y flag', () => {
    // Create a test skill
    const skillDir = join(testDir, 'skills', 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---
name: my-skill
description: My test skill
---

# My Skill

Instructions here.
`
    );

    // Create a target directory to install to
    const targetDir = join(testDir, 'project');
    mkdirSync(targetDir, { recursive: true });

    const result = runCli(['add', testDir, '-y', '-g', '--agent', 'claude-code'], targetDir);
    expect(result.stdout).toContain('my-skill');
    expect(result.stdout).toContain('Done!');
    expect(result.exitCode).toBe(0);
  });

  it('should filter skills by name with --skill flag', () => {
    // Create multiple test skills
    const skill1Dir = join(testDir, 'skills', 'skill-one');
    const skill2Dir = join(testDir, 'skills', 'skill-two');
    mkdirSync(skill1Dir, { recursive: true });
    mkdirSync(skill2Dir, { recursive: true });

    writeFileSync(
```


[35m文件: src/add.ts[0m
```ts
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { sep } from 'path';
import { parseSource, getOwnerRepo, parseOwnerRepo, isRepoPrivate } from './source-parser.ts';
import { searchMultiselect, cancelSymbol } from './prompts/search-multiselect.ts';

// Helper to check if a value is a cancel symbol (works with both clack and our custom prompts)
const isCancelled = (value: unknown): value is symbol => typeof value === 'symbol';

/**
 * Check if a source identifier (owner/repo format) represents a private GitHub repo.
 * Returns true if private, false if public, null if unable to determine or not a GitHub repo.
 */
async function isSourcePrivate(source: string): Promise<boolean | null> {
  const ownerRepo = parseOwnerRepo(source);
  if (!ownerRepo) {
    // Not in owner/repo format, assume not private (could be other providers)
    return false;
  }
  return isRepoPrivate(ownerRepo.owner, ownerRepo.repo);
}
import { cloneRepo, cleanupTempDir, GitCloneError } from './git.ts';
import { discoverSkills, getSkillDisplayName, filterSkills } from './skills.ts';
import {
  installSkillForAgent,
  isSkillInstalled,
  getInstallPath,
  getCanonicalPath,
  installWellKnownSkillForAgent,
  type InstallMode,
} from './installer.ts';
import {
  detectInstalledAgents,
  agents,
  getUniversalAgents,
  getNonUniversalAgents,
  isUniversalAgent,
} from './agents.ts';
import {
  track,
  setVersion,
  fetchAuditData,
  type AuditResponse,
  type SkillAuditData,
  type PartnerAudit,
} from './telemetry.ts';
import { wellKnownProvider, type WellKnownSkill } from './providers/index.ts';
import {
  addSkillToLock,
  fetchSkillFolderHash,
  getGitHubToken,
  isPromptDismissed,
  dismissPrompt,
  getLastSelectedAgents,
  saveSelectedAgents,
} from './skill-lock.ts';
import { addSkillToLocalLock, computeSkillFolderHash } from './local-lock.ts';
import type { Skill, AgentType } from './types.ts';
import packageJson from '../package.json' with { type: 'json' };
export function initTelemetry(version: string): void {
  setVersion(version);
}

// ─── Security Advisory ───

function riskLabel(risk: string): string {
  switch (risk) {
    case 'critical':
      return pc.red(pc.bold('Critical Risk'));
    case 'high':
      return pc.red('High Risk');
    case 'medium':
      return pc.yellow('Med Risk');
    case 'low':
      return pc.green('Low Risk');
    case 'safe':
      return pc.green('Safe');
    default:
      return pc.dim('--');
  }
}

function socketLabel(audit: PartnerAudit | undefined): string {
  if (!audit) return pc.dim('--');
  const count = audit.alerts ?? 0;
  return count > 0 ? pc.red(`${count} alert${count !== 1 ? 's' : ''}`) : pc.green('0 alerts');
}

/** Pad a string to a given visible width (ignoring ANSI escape codes). */
function padEnd(str: string, width: number): string {
  // Strip ANSI codes to measure visible length
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, width - visible.length);
  return str + ' '.repeat(pad);
}

/**
 * Render a compact security table showing partner audit results.
```


[35m文件: src/agents.ts[0m
```ts
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { xdgConfig } from 'xdg-basedir';
import type { AgentConfig, AgentType } from './types.ts';

const home = homedir();
// Use xdg-basedir (not env-paths) to match OpenCode/Amp/Goose behavior on all platforms.
const configHome = xdgConfig ?? join(home, '.config');
const codexHome = process.env.CODEX_HOME?.trim() || join(home, '.codex');
const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, '.claude');

export function getOpenClawGlobalSkillsDir(
  homeDir = home,
  pathExists: (path: string) => boolean = existsSync
) {
  if (pathExists(join(homeDir, '.openclaw'))) {
    return join(homeDir, '.openclaw/skills');
  }
  if (pathExists(join(homeDir, '.clawdbot'))) {
    return join(homeDir, '.clawdbot/skills');
  }
  if (pathExists(join(homeDir, '.moltbot'))) {
    return join(homeDir, '.moltbot/skills');
  }
  return join(homeDir, '.openclaw/skills');
}

export const agents: Record<AgentType, AgentConfig> = {
  amp: {
    name: 'amp',
    displayName: 'Amp',
    skillsDir: '.agents/skills',
    globalSkillsDir: join(configHome, 'agents/skills'),
    detectInstalled: async () => {
      return existsSync(join(configHome, 'amp'));
    },
  },
  antigravity: {
    name: 'antigravity',
    displayName: 'Antigravity',
    skillsDir: '.agent/skills',
    globalSkillsDir: join(home, '.gemini/antigravity/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.gemini/antigravity'));
    },
  },
  augment: {
    name: 'augment',
    displayName: 'Augment',
    skillsDir: '.augment/skills',
    globalSkillsDir: join(home, '.augment/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.augment'));
    },
  },
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    globalSkillsDir: join(claudeHome, 'skills'),
    detectInstalled: async () => {
      return existsSync(claudeHome);
    },
  },
  openclaw: {
    name: 'openclaw',
    displayName: 'OpenClaw',
    skillsDir: 'skills',
    globalSkillsDir: getOpenClawGlobalSkillsDir(),
    detectInstalled: async () => {
      return (
        existsSync(join(home, '.openclaw')) ||
        existsSync(join(home, '.clawdbot')) ||
        existsSync(join(home, '.moltbot'))
      );
    },
  },
  cline: {
    name: 'cline',
    displayName: 'Cline',
    skillsDir: '.agents/skills',
    globalSkillsDir: join(home, '.agents', 'skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.cline'));
    },
  },
  codebuddy: {
    name: 'codebuddy',
    displayName: 'CodeBuddy',
    skillsDir: '.codebuddy/skills',
    globalSkillsDir: join(home, '.codebuddy/skills'),
    detectInstalled: async () => {
      return existsSync(join(process.cwd(), '.codebuddy')) || existsSync(join(home, '.codebuddy'));
    },
  },
  codex: {
    name: 'codex',
    displayName: 'Codex',
    skillsDir: '.agents/skills',
```


[35m文件: src/cli.test.ts[0m
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runCliOutput, stripLogo, hasLogo } from './test-utils.ts';

describe('skills CLI', () => {
  describe('--help', () => {
    it('should display help message', () => {
      const output = runCliOutput(['--help']);
      expect(output).toContain('Usage: skills <command> [options]');
      expect(output).toContain('Manage Skills:');
      expect(output).toContain('init [name]');
      expect(output).toContain('add <package>');
      expect(output).toContain('check');
      expect(output).toContain('update');
      expect(output).toContain('Add Options:');
      expect(output).toContain('-g, --global');
      expect(output).toContain('-a, --agent');
      expect(output).toContain('-s, --skill');
      expect(output).toContain('-l, --list');
      expect(output).toContain('-y, --yes');
      expect(output).toContain('--all');
    });

    it('should show same output for -h alias', () => {
      const helpOutput = runCliOutput(['--help']);
      const hOutput = runCliOutput(['-h']);
      expect(hOutput).toBe(helpOutput);
    });
  });

  describe('--version', () => {
    it('should display version number', () => {
      const output = runCliOutput(['--version']);
      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should match package.json version', () => {
      const output = runCliOutput(['--version']);
      const pkg = JSON.parse(
        readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8')
      );
      expect(output.trim()).toBe(pkg.version);
    });
  });

  describe('no arguments', () => {
    it('should display banner', () => {
      const output = stripLogo(runCliOutput([]));
      expect(output).toContain('The open agent skills ecosystem');
      expect(output).toContain('npx skills add');
      expect(output).toContain('npx skills check');
      expect(output).toContain('npx skills update');
      expect(output).toContain('npx skills init');
      expect(output).toContain('skills.sh');
    });
  });

  describe('unknown command', () => {
    it('should show error for unknown command', () => {
      const output = runCliOutput(['unknown-command']);
      expect(output).toMatchInlineSnapshot(`
        "Unknown command: unknown-command
        Run skills --help for usage.
        "
      `);
    });
  });

  describe('logo display', () => {
    it('should not display logo for list command', () => {
      const output = runCliOutput(['list']);
      expect(hasLogo(output)).toBe(false);
    });

    it('should not display logo for check command', () => {
      // Note: check command makes GitHub API calls, so we just verify initial output
      const output = runCliOutput(['check']);
      expect(hasLogo(output)).toBe(false);
    }, 60000);

    it('should not display logo for update command', () => {
      // Note: update command makes GitHub API calls, so we just verify initial output
      const output = runCliOutput(['update']);
      expect(hasLogo(output)).toBe(false);
    }, 60000);
  });
});
```


[35m文件: src/cli.ts[0m
```ts
#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { basename, join, dirname } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { runAdd, parseAddOptions, initTelemetry } from './add.ts';
import { runFind } from './find.ts';
import { runInstallFromLock } from './install.ts';
import { runList } from './list.ts';
import { removeCommand, parseRemoveOptions } from './remove.ts';
import { runSync, parseSyncOptions } from './sync.ts';
import { track } from './telemetry.ts';
import { fetchSkillFolderHash, getGitHubToken } from './skill-lock.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const VERSION = getVersion();
initTelemetry(VERSION);

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
// 256-color grays - visible on both light and dark backgrounds
const DIM = '\x1b[38;5;102m'; // darker gray for secondary text
const TEXT = '\x1b[38;5;145m'; // lighter gray for primary text

const LOGO_LINES = [
  '███████╗██╗  ██╗██╗██╗     ██╗     ███████╗',
  '██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝',
  '███████╗█████╔╝ ██║██║     ██║     ███████╗',
  '╚════██║██╔═██╗ ██║██║     ██║     ╚════██║',
  '███████║██║  ██╗██║███████╗███████╗███████║',
  '╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝',
];

// 256-color middle grays - visible on both light and dark backgrounds
const GRAYS = [
  '\x1b[38;5;250m', // lighter gray
  '\x1b[38;5;248m',
  '\x1b[38;5;245m', // mid gray
  '\x1b[38;5;243m',
  '\x1b[38;5;240m',
  '\x1b[38;5;238m', // darker gray
];

function showLogo(): void {
  console.log();
  LOGO_LINES.forEach((line, i) => {
    console.log(`${GRAYS[i]}${line}${RESET}`);
  });
}

function showBanner(): void {
  showLogo();
  console.log();
  console.log(`${DIM}The open agent skills ecosystem${RESET}`);
  console.log();
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills add ${DIM}<package>${RESET}        ${DIM}Add a new skill${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills remove${RESET}               ${DIM}Remove installed skills${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills list${RESET}                 ${DIM}List installed skills${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills find ${DIM}[query]${RESET}         ${DIM}Search for skills${RESET}`
  );
  console.log();
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills check${RESET}                ${DIM}Check for updates${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills update${RESET}               ${DIM}Update all skills${RESET}`
  );
  console.log();
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills experimental_install${RESET} ${DIM}Restore from skills-lock.json${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills init ${DIM}[name]${RESET}          ${DIM}Create a new skill${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx skills experimental_sync${RESET}    ${DIM}Sync skills from node_modules${RESET}`
  );
  console.log();
  console.log(`${DIM}try:${RESET} npx skills add vercel-labs/agent-skills`);
```


[35m依赖项详情[0m

[35mpackage.json[0m
```
{
  "name": "skills",
  "version": "1.4.4",
  "description": "The open agent skills ecosystem",
  "type": "module",
  "bin": {
    "skills": "./bin/cli.mjs",
    "add-skill": "./bin/cli.mjs"
  },
  "files": [
    "dist",
    "bin",
    "README.md",
    "ThirdPartyNoticeText.txt"
  ],
  "scripts": {
    "build": "node scripts/generate-licenses.ts && obuild",
    "generate-licenses": "node scripts/generate-licenses.ts",
    "dev": "node src/cli.ts",
    "exec:test": "node scripts/execute-tests.ts",
    "prepublishOnly": "npm run build",
    "format": "prettier --write 'src/**/*.ts' 'scripts/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts' 'scripts/**/*.ts'",
    "prepare": "husky",
    "test": "vitest",
    "type-check": "tsc --noEmit",
    "publish:snapshot": "npm version prerelease --preid=snapshot --no-git-tag-version && npm publish --tag snapshot"
  },
  "lint-staged": {
    "src/**/*.ts": "prettier --write",
    "scripts/**/*.ts": "prettier --write",
    "tests/**/*.ts": "prettier --write"
  },
  "keywords": [
    "cli",
    "agent-skills",
    "skills",
    "ai-agents",
    "amp",
    "antigravity",
    "augment",
    "claude-code",
    "openclaw",
    "cline",
    "codebuddy",
    "codex",
    "command-code",
    "continue",
    "cortex",
    "crush",
    "cursor",
    "droid",
    "gemini-cli",
    "github-copilot",
    "goose",
    "junie",
    "iflow-cli",
    "kilo",
    "kimi-cli",
    "kiro-cli",
    "kode",
    "mcpjam",
    "mistral-vibe",
    "mux",
    "opencode",
    "openhands",
    "pi",
    "qoder",
    "qwen-code",
    "replit",
    "roo",
    "trae",
    "trae-cn",
    "windsurf",
    "zencoder",
    "neovate",
    "pochi",
    "adal",
    "universal"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/vercel-labs/skills.git"
  },
  "homepage": "https://github.com/vercel-labs/skills#readme",
  "bugs": {
    "url": "https://github.com/vercel-labs/skills/issues"
  },
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "@clack/prompts": "^0.11.0",
    "@types/bun": "latest",
    "@types/node": "^22.10.0",
    "gray-matter": "^4.0.3",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "obuild": "^0.4.22",
    "picocolors": "^1.1.1",
    "prettier": "^3.8.1",
    "simple-git": "^3.27.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.17",
    "xdg-basedir": "^5.1.0"
  },
  "engines": {
    "node": ">=18"
  },
  "packageManager": "pnpm@10.17.1"
}

```
