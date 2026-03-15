#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const ARCHITECTURE_DOCS = new Set([
  'docs/project-architecture-foundation.md',
  'docs/architecture-change-checklist.md',
]);

const HIGH_RISK_ARCHITECTURE_PATHS = [
  'shared/ipcChannels.ts',
  'shared/electron-api.d.ts',
  'shared/planRules.ts',
  'shared/planRules.data.json',
  'shared/authFeatureRules.ts',
  'shared/authFeatureRules.data.json',
  'electron/main/ipc/auth.ts',
  'electron/preload/auth.ts',
  'src/stores/authStore.ts',
  'src/services/apiClient.ts',
  'src/tasks/TaskManager.ts',
  'src/utils/TaskStateManager.ts',
  'src/utils/stopAllLiveTasks.ts',
  'src/hooks/useAppIpcBootstrap.ts',
  'src/domain/access/AccessControl.ts',
  'src/domain/access/AccessPolicy.ts',
  'src/pages/SubAccount/index.tsx',
  'src/hooks/useSubAccount.ts',
  'electron/main/ipc/subAccount.ts',
  'src/utils/commentListenerRuntime.ts',
  'src/tasks/autoReplyTask.ts',
  'src/pages/LiveStats/index.tsx',
  'electron/main/ipc/commentListener.ts',
  'electron/main/tasks/CommentListenerTask.ts',
];

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function getChangedFiles() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (eventName && eventPath && fs.existsSync(eventPath)) {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

    if (eventName === 'pull_request' && event.pull_request?.base?.sha && event.pull_request?.head?.sha) {
      return runGit(['diff', '--name-only', `${event.pull_request.base.sha}...${event.pull_request.head.sha}`])
        .split('\n')
        .filter(Boolean);
    }

    if (eventName === 'push' && event.before && event.after && event.before !== '0000000000000000000000000000000000000000') {
      return runGit(['diff', '--name-only', `${event.before}...${event.after}`])
        .split('\n')
        .filter(Boolean);
    }
  }

  return runGit(['diff', '--name-only', 'HEAD~1...HEAD'])
    .split('\n')
    .filter(Boolean);
}

function isHighRiskArchitectureChange(file) {
  return HIGH_RISK_ARCHITECTURE_PATHS.some((path) => file === path || file.startsWith(`${path}/`));
}

const changedFiles = getChangedFiles();
const changedArchitectureDocs = changedFiles.filter((file) => ARCHITECTURE_DOCS.has(file));
const changedHighRiskFiles = changedFiles.filter(isHighRiskArchitectureChange);

if (changedHighRiskFiles.length === 0) {
  console.log('No high-risk architecture files changed. Skipping architecture doc sync check.');
  process.exit(0);
}

if (changedArchitectureDocs.length > 0) {
  console.log('Architecture docs updated together with high-risk architecture changes.');
  console.log(`Docs changed: ${changedArchitectureDocs.join(', ')}`);
  process.exit(0);
}

console.error('High-risk architecture files changed without updating architecture docs.');
console.error('Changed high-risk files:');
for (const file of changedHighRiskFiles) {
  console.error(`- ${file}`);
}
console.error('Please update at least one of:');
for (const file of ARCHITECTURE_DOCS) {
  console.error(`- ${file}`);
}
process.exit(1);
