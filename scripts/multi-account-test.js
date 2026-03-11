/**
 * 多账号切换场景测试脚本
 * 测试目标：验证账号A在任务运行期间，切换到账号B时，账号A是否会异常断开连接
 */

const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  logFile: path.join(__dirname, '../logs/multi-account-test.log'),
  testDuration: 5 * 60 * 1000, // 5分钟测试时长
  checkInterval: 5000, // 每5秒检查一次状态
};

// 确保日志目录存在
const logDir = path.dirname(TEST_CONFIG.logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志记录函数
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type}] ${message}\n`;
  
  console.log(logEntry.trim());
  fs.appendFileSync(TEST_CONFIG.logFile, logEntry);
}

// 测试报告
class MultiAccountTestReport {
  constructor() {
    this.startTime = Date.now();
    this.events = [];
    this.accountAState = {
      id: 'account-a-test',
      name: '测试账号A',
      connected: false,
      taskRunning: false,
      disconnectTime: null,
      disconnectReason: null,
    };
    this.accountBState = {
      id: 'account-b-test',
      name: '测试账号B',
      connected: false,
      taskRunning: false,
    };
  }

  recordEvent(event, details = {}) {
    const eventData = {
      timestamp: Date.now(),
      event,
      details,
    };
    this.events.push(eventData);
    log(`事件记录: ${event} - ${JSON.stringify(details)}`);
  }

  updateAccountAState(state) {
    Object.assign(this.accountAState, state);
    log(`账号A状态更新: ${JSON.stringify(state)}`);
  }

  updateAccountBState(state) {
    Object.assign(this.accountBState, state);
    log(`账号B状态更新: ${JSON.stringify(state)}`);
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    const report = {
      testDuration: `${duration}ms (${(duration / 1000).toFixed(2)}s)`,
      accountA: this.accountAState,
      accountB: this.accountBState,
      events: this.events,
      summary: {
        totalEvents: this.events.length,
        accountADisconnected: !!this.accountAState.disconnectTime,
        accountADisconnectReason: this.accountAState.disconnectReason,
      },
    };

    return report;
  }
}

// 模拟测试场景
async function runMultiAccountTest() {
  log('========================================');
  log('开始多账号切换场景测试');
  log('========================================');
  
  const report = new MultiAccountTestReport();
  
  // 测试步骤1: 登录账号A并启动任务
  log('步骤1: 登录账号A并启动任务');
  report.recordEvent('TEST_STEP_1_START', { step: '登录账号A并启动任务' });
  report.updateAccountAState({ connected: true, taskRunning: true });
  report.recordEvent('ACCOUNT_A_CONNECTED', { accountId: report.accountAState.id });
  report.recordEvent('ACCOUNT_A_TASK_STARTED', { accountId: report.accountAState.id });
  
  // 等待一段时间模拟任务运行
  await sleep(10000);
  
  // 测试步骤2: 保持账号A任务运行，切换登录账号B
  log('步骤2: 保持账号A任务运行，切换登录账号B');
  report.recordEvent('TEST_STEP_2_START', { step: '切换到账号B' });
  report.updateAccountBState({ connected: true });
  report.recordEvent('ACCOUNT_B_CONNECTED', { accountId: report.accountBState.id });
  
  // 监控账号A的连接状态
  log('开始监控账号A的连接状态...');
  const checkInterval = setInterval(() => {
    // 模拟检查账号A是否仍然连接
    // 在实际测试中，这里应该调用实际的API检查连接状态
    const isAccountAConnected = checkAccountAConnection();
    
    if (!isAccountAConnected && report.accountAState.connected) {
      // 账号A断开连接
      report.updateAccountAState({
        connected: false,
        taskRunning: false,
        disconnectTime: Date.now(),
        disconnectReason: '检测到与中控台断开连接',
      });
      report.recordEvent('ACCOUNT_A_DISCONNECTED', {
        accountId: report.accountAState.id,
        reason: '检测到与中控台断开连接',
      });
    }
  }, TEST_CONFIG.checkInterval);
  
  // 测试运行一段时间
  await sleep(TEST_CONFIG.testDuration);
  
  // 停止监控
  clearInterval(checkInterval);
  
  // 生成测试报告
  log('========================================');
  log('测试完成，生成报告');
  log('========================================');
  
  const finalReport = report.generateReport();
  const reportPath = path.join(__dirname, '../logs/multi-account-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
  
  log(`测试报告已保存: ${reportPath}`);
  log('测试摘要:');
  log(`- 测试时长: ${finalReport.testDuration}`);
  log(`- 账号A断开连接: ${finalReport.summary.accountADisconnected ? '是' : '否'}`);
  if (finalReport.summary.accountADisconnected) {
    log(`- 断开原因: ${finalReport.summary.accountADisconnectReason}`);
  }
  log(`- 总事件数: ${finalReport.summary.totalEvents}`);
  
  return finalReport;
}

// 辅助函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkAccountAConnection() {
  // 模拟检查连接状态
  // 在实际测试中，这里应该调用实际的API
  // 返回 true 表示连接正常，false 表示断开
  return true; // 默认假设连接正常
}

// 运行测试
runMultiAccountTest().catch(error => {
  log(`测试执行出错: ${error.message}`, 'ERROR');
  process.exit(1);
});
