/**
 * 多账号功能验证脚本
 * 验证关键的多账号隔离功能
 */

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../logs/verification-result.log');
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${type}] ${message}\n`;
  console.log(entry.trim());
  fs.appendFileSync(logFile, entry);
}

// 验证结果
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function check(name, condition, details = '') {
  if (condition) {
    results.passed.push(name);
    log(`✅ ${name}${details ? ' - ' + details : ''}`, 'PASS');
    return true;
  } else {
    results.failed.push(name);
    log(`❌ ${name}${details ? ' - ' + details : ''}`, 'FAIL');
    return false;
  }
}

function warn(name, details) {
  results.warnings.push(name);
  log(`⚠️ ${name} - ${details}`, 'WARN');
}

// 读取并分析源代码
function analyzeSourceCode() {
  log('========================================');
  log('开始分析源代码');
  log('========================================');

  // 1. 检查 TaskManager 的账号隔离实现
  const taskManagerPath = path.join(__dirname, '../src/tasks/TaskManager.ts');
  const taskManagerContent = fs.readFileSync(taskManagerPath, 'utf-8');

  check(
    'TaskManager 使用 accountTasks Map 进行账号隔离',
    taskManagerContent.includes('accountTasks: Map<string, Map<TaskId, AccountTaskState>>'),
    '发现账号隔离数据结构'
  );

  check(
    'TaskManager 有 getOrCreateAccountTaskState 方法',
    taskManagerContent.includes('getOrCreateAccountTaskState'),
    '发现账号状态管理方法'
  );

  check(
    'TaskManager start 方法检查账号级别的任务状态',
    taskManagerContent.includes('taskState.status === \'running\'') &&
    taskManagerContent.includes('for account'),
    '正确的状态检查逻辑'
  );

  check(
    'TaskManager stop 方法支持 accountId 参数',
    taskManagerContent.includes('stop(taskId: TaskId, reason: StopReason, accountId?: string)'),
    '支持按账号停止任务'
  );

  check(
    'TaskManager 有 cleanupAccount 方法',
    taskManagerContent.includes('cleanupAccount(accountId: string)'),
    '支持账号清理'
  );

  // 2. 检查 useAutoMessage 的数据隔离
  const autoMessagePath = path.join(__dirname, '../src/hooks/useAutoMessage.ts');
  const autoMessageContent = fs.readFileSync(autoMessagePath, 'utf-8');

  check(
    'useAutoMessage 使用 contexts[accountId] 结构',
    autoMessageContent.includes('contexts: Record<string, AutoMessageContext>'),
    '发现数据隔离结构'
  );

  check(
    'useAutoMessage 监听 ACCOUNT_REMOVED 事件清理数据',
    autoMessageContent.includes('EVENTS.ACCOUNT_REMOVED') &&
    autoMessageContent.includes('delete state.contexts[accountId]'),
    '正确的数据清理逻辑'
  );

  check(
    'useAutoMessage 持久化时排除 isRunning',
    autoMessageContent.includes('filter(([key]) => key !== \'isRunning\')'),
    '运行时状态不持久化'
  );

  // 3. 检查 useAccounts 的实现
  const accountsPath = path.join(__dirname, '../src/hooks/useAccounts.ts');
  const accountsContent = fs.readFileSync(accountsPath, 'utf-8');

  check(
    'useAccounts 有 switchAccount 方法',
    accountsContent.includes('switchAccount: (id: string) =>'),
    '发现账号切换方法'
  );

  check(
    'useAccounts 发送 ACCOUNT_SWITCHED 事件',
    accountsContent.includes('eventEmitter.emit(EVENTS.ACCOUNT_SWITCHED'),
    '正确的事件通知'
  );

  // 4. 检查 App.tsx 的账号切换处理
  const appPath = path.join(__dirname, '../src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  check(
    'App.tsx 处理账号切换事件',
    appContent.includes('IPC_CHANNELS.account.switch'),
    '发现账号切换处理'
  );

  check(
    'App.tsx 智能重置状态（只重置 connecting）',
    appContent.includes('currentState?.status === \'connecting\'') &&
    appContent.includes('如果状态是 connected，保持原状态'),
    '正确的状态重置逻辑'
  );

  // 5. 检查 useTaskManager
  const taskManagerHookPath = path.join(__dirname, '../src/hooks/useTaskManager.ts');
  const taskManagerHookContent = fs.readFileSync(taskManagerHookPath, 'utf-8');

  check(
    'useTaskManager 传入 accountId 停止任务',
    taskManagerHookContent.includes('taskManager.stop(taskId, reason, currentAccountId)'),
    '正确的停止任务调用'
  );

  check(
    'useTaskManager 传入 accountId 获取状态',
    taskManagerHookContent.includes('taskManager.getStatus(taskId, currentAccountId)'),
    '正确的获取状态调用'
  );

  // 6. 检查主进程的账号管理
  const accountManagerPath = path.join(__dirname, '../electron/main/managers/AccountManager.ts');
  if (fs.existsSync(accountManagerPath)) {
    const accountManagerContent = fs.readFileSync(accountManagerPath, 'utf-8');

    check(
      'AccountManager 使用 Map 存储账号会话',
      accountManagerContent.includes('accountSessions: Map<string, AccountSession>'),
      '发现会话隔离结构'
    );

    check(
      'AccountManager 有防重入标记',
      accountManagerContent.includes('isDisconnecting') ||
      accountManagerContent.includes('isDisconnected'),
      '发现防重入机制'
    );
  } else {
    warn('AccountManager 文件检查', '文件路径不存在');
  }

  // 7. 检查 AccountSession
  const accountSessionPath = path.join(__dirname, '../electron/main/services/AccountSession.ts');
  if (fs.existsSync(accountSessionPath)) {
    const accountSessionContent = fs.readFileSync(accountSessionPath, 'utf-8');

    check(
      'AccountSession 有防重入标记',
      accountSessionContent.includes('isDisconnecting') &&
      accountSessionContent.includes('isDisconnected'),
      '发现防重入机制'
    );

    check(
      'AccountSession page-close 事件有验证逻辑',
      accountSessionContent.includes('已经在断开中或已断开，忽略重复事件'),
      '正确的重复事件处理'
    );
  } else {
    warn('AccountSession 文件检查', '文件路径不存在');
  }
}

// 检查构建输出
function checkBuildOutput() {
  log('');
  log('========================================');
  log('检查构建输出');
  log('========================================');

  const distPath = path.join(__dirname, '../dist');
  const distElectronPath = path.join(__dirname, '../dist-electron');

  check(
    'dist 目录存在',
    fs.existsSync(distPath),
    '渲染进程构建输出存在'
  );

  check(
    'dist-electron 目录存在',
    fs.existsSync(distElectronPath),
    '主进程构建输出存在'
  );

  // 检查关键文件
  const keyFiles = [
    'dist/index.html',
    'dist-electron/main/index.js',
    'dist-electron/preload/index.js'
  ];

  keyFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    check(
      `${file} 存在`,
      fs.existsSync(filePath),
      '关键文件已生成'
    );
  });
}

// 生成测试场景
function generateTestScenarios() {
  log('');
  log('========================================');
  log('推荐测试场景');
  log('========================================');

  const scenarios = [
    {
      name: '基础隔离测试',
      steps: [
        '1. 启动应用并登录账号A',
        '2. 在自动发言页面添加消息 "A消息1"',
        '3. 切换到账号B',
        '4. 在自动发言页面添加消息 "B消息1"',
        '5. 切换回账号A，验证消息列表为 ["A消息1"]',
        '6. 切换到账号B，验证消息列表为 ["B消息1"]'
      ]
    },
    {
      name: '任务状态隔离测试',
      steps: [
        '1. 账号A连接中控台并启动自动发言',
        '2. 切换到账号B',
        '3. 验证账号B可以正常启动自动发言（无"任务正在运行中"错误）',
        '4. 验证账号A的自动发言仍在运行',
        '5. 停止账号B的自动发言',
        '6. 验证账号A的自动发言不受影响'
      ]
    },
    {
      name: '快速切换压力测试',
      steps: [
        '1. 账号A启动自动发言',
        '2. 快速切换 A→B→A→B→A',
        '3. 每次切换后验证状态显示正确',
        '4. 检查浏览器控制台无错误日志',
        '5. 检查系统内存占用无异常增长'
      ]
    },
    {
      name: '并发任务测试',
      steps: [
        '1. 账号A连接中控台',
        '2. 账号B连接中控台（不同浏览器实例）',
        '3. 同时启动两个账号的自动发言',
        '4. 验证两个任务独立运行',
        '5. 分别停止，验证互不影响'
      ]
    },
    {
      name: '持久化隔离测试',
      steps: [
        '1. 账号A设置自动发言消息 ["A1", "A2"]',
        '2. 账号B设置自动发言消息 ["B1", "B2"]',
        '3. 刷新页面（模拟重启）',
        '4. 验证账号A配置恢复为 ["A1", "A2"]',
        '5. 验证账号B配置恢复为 ["B1", "B2"]'
      ]
    }
  ];

  scenarios.forEach((scenario, index) => {
    log(`\n场景 ${index + 1}: ${scenario.name}`);
    scenario.steps.forEach(step => {
      log(`  ${step}`);
    });
  });
}

// 生成最终报告
function generateReport() {
  log('');
  log('========================================');
  log('验证报告');
  log('========================================');
  log(`通过: ${results.passed.length} 项`);
  log(`失败: ${results.failed.length} 项`);
  log(`警告: ${results.warnings.length} 项`);
  log(`通过率: ${((results.passed.length / (results.passed.length + results.failed.length)) * 100).toFixed(1)}%`);
  log('========================================');

  if (results.failed.length > 0) {
    log('');
    log('失败的检查项:');
    results.failed.forEach(item => {
      log(`  ❌ ${item}`);
    });
  }

  if (results.warnings.length > 0) {
    log('');
    log('警告项:');
    results.warnings.forEach(item => {
      log(`  ⚠️ ${item}`);
    });
  }

  // 保存详细报告
  const reportPath = path.join(__dirname, '../logs/verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      passed: results.passed.length,
      failed: results.failed.length,
      warnings: results.warnings.length,
      passRate: ((results.passed.length / (results.passed.length + results.failed.length)) * 100).toFixed(1) + '%'
    },
    details: results
  }, null, 2));

  log('');
  log(`详细报告已保存: ${reportPath}`);
}

// 主函数
function main() {
  log('========================================');
  log('多账号功能验证工具');
  log('========================================');
  log('');

  try {
    analyzeSourceCode();
    checkBuildOutput();
    generateTestScenarios();
    generateReport();

    log('');
    log('========================================');
    log('验证完成');
    log('========================================');
    log('');
    log('下一步:');
    log('1. 启动开发服务器: npm run dev');
    log('2. 按照推荐测试场景执行手动测试');
    log('3. 查看 logs/manual-test-checklist.md 获取详细测试清单');

  } catch (error) {
    log(`验证过程出错: ${error.message}`, 'ERROR');
    console.error(error);
  }
}

main();
