/**
 * Error Alert Module - 错误告警模块
 *
 * 功能：
 * 1. 监控 ~/.claude/logs/ 目录
 * 2. 实时检测新的错误日志
 * 3. 解析错误信息和堆栈
 * 4. 发送告警通知
 */

const HeartbeatModule = require('../module-interface');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ErrorAlert extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 日志目录路径
    this.logDir = path.join(os.homedir(), '.claude', 'logs');

    // 文件监视器
    this.watcher = null;

    // 已处理的日志文件（避免重复告警）
    this.processedFiles = new Set();

    // 文件读取位置记录（用于增量读取）
    this.filePositions = new Map();
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();

    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
      this.log('Log directory created');
    }
  }

  /**
   * 启动模块
   */
  async start() {
    if (!this.enabled) {
      this.log('Module is disabled, skipping start');
      return;
    }

    this.log('Module starting...');

    // 扫描现有日志文件
    await this.scanExistingLogs();

    // 启动文件监视器
    this.startWatcher();

    this.log('Module started');
  }

  /**
   * 停止模块
   */
  async stop() {
    await super.stop();

    // 停止文件监视器
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.log('File watcher stopped');
    }
  }

  /**
   * 执行模块任务（定期检查）
   */
  async execute() {
    // 这个模块主要依赖 fs.watch 实时监控
    // execute 方法用于定期检查是否有遗漏的日志
    try {
      await this.scanExistingLogs();
      this.log('Periodic log scan completed');
    } catch (error) {
      this.log(`Failed to scan logs: ${error.message}`, 'error');
    }
  }

  /**
   * 启动文件监视器
   */
  startWatcher() {
    try {
      this.watcher = fs.watch(this.logDir, { recursive: false }, (eventType, filename) => {
        if (!filename) return;

        // 只监控 .log 文件
        if (!filename.endsWith('.log')) return;

        // 排除 heartbeat 自己的日志文件（避免循环）
        if (filename === 'heartbeat-v2.log' || filename === 'heartbeat-v2-start.log') {
          return;
        }

        const filePath = path.join(this.logDir, filename);

        // 延迟处理，避免文件正在写入
        setTimeout(() => {
          this.processLogFile(filePath).catch(error => {
            this.log(`Failed to process log file ${filename}: ${error.message}`, 'error');
          });
        }, 100);
      });

      this.log('File watcher started');
    } catch (error) {
      this.log(`Failed to start file watcher: ${error.message}`, 'error');
    }
  }

  /**
   * 扫描现有日志文件
   */
  async scanExistingLogs() {
    try {
      const files = fs.readdirSync(this.logDir);

      for (const filename of files) {
        if (!filename.endsWith('.log')) continue;

        // 排除 heartbeat 自己的日志文件（避免循环）
        if (filename === 'heartbeat-v2.log' || filename === 'heartbeat-v2-start.log') {
          continue;
        }

        const filePath = path.join(this.logDir, filename);
        await this.processLogFile(filePath);
      }
    } catch (error) {
      this.log(`Failed to scan existing logs: ${error.message}`, 'error');
    }
  }

  /**
   * 处理日志文件
   */
  async processLogFile(filePath) {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) return;

      // 获取文件状态
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) return;

      // 获取上次读取位置
      const lastPosition = this.filePositions.get(filePath) || 0;

      // 如果文件没有新内容，跳过
      if (stats.size <= lastPosition) return;

      // 读取新内容
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(stats.size - lastPosition);
      fs.readSync(fd, buffer, 0, buffer.length, lastPosition);
      fs.closeSync(fd);

      // 更新读取位置
      this.filePositions.set(filePath, stats.size);

      // 解析日志内容
      const content = buffer.toString('utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      // 处理每一行日志
      for (const line of lines) {
        await this.processLogLine(line, filePath);
      }

    } catch (error) {
      this.log(`Failed to process log file ${filePath}: ${error.message}`, 'error');
    }
  }

  /**
   * 处理单行日志
   */
  async processLogLine(line, filePath) {
    try {
      // 尝试解析 JSON 格式的日志
      let logEntry;
      try {
        logEntry = JSON.parse(line);
      } catch {
        // 如果不是 JSON，尝试解析纯文本格式
        logEntry = this.parseTextLog(line);
      }

      if (!logEntry) return;

      // 检查是否是错误或警告
      const level = (logEntry.level || '').toLowerCase();
      if (level !== 'error' && level !== 'warning' && level !== 'warn') {
        return;
      }

      // 发送告警
      await this.sendAlert(logEntry, filePath);

    } catch (error) {
      this.log(`Failed to process log line: ${error.message}`, 'error');
    }
  }

  /**
   * 解析纯文本日志
   */
  parseTextLog(line) {
    // 尝试匹配常见的日志格式
    // 例如：[2024-01-10 12:34:56] ERROR: Something went wrong
    const patterns = [
      /\[(.*?)\]\s*(ERROR|WARNING|WARN):\s*(.*)/i,
      /(ERROR|WARNING|WARN):\s*(.*)/i,
      /^(.*?)\s*-\s*(ERROR|WARNING|WARN)\s*-\s*(.*)/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          timestamp: match[1] || new Date().toISOString(),
          level: match[2] || match[1],
          message: match[3] || match[2] || line
        };
      }
    }

    // 如果包含 error 或 warning 关键词，也认为是错误日志
    if (/error|warning|exception|failed/i.test(line)) {
      return {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: line
      };
    }

    return null;
  }

  /**
   * 发送告警
   */
  async sendAlert(logEntry, filePath) {
    try {
      const level = (logEntry.level || '').toLowerCase();
      const isError = level === 'error';
      const icon = isError ? '🔴' : '⚠️';
      const levelText = isError ? 'Error' : 'Warning';

      // 格式化时间
      const timestamp = logEntry.timestamp || new Date().toISOString();
      const timeStr = new Date(timestamp).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false
      });

      // 提取错误消息
      const message = logEntry.message || logEntry.msg || 'Unknown error';

      // 提取堆栈信息
      const stack = logEntry.stack || logEntry.stackTrace || '';

      // 提取文件名
      const filename = path.basename(filePath);

      // 构建告警消息（限制总长度在3500字符以内，为Telegram 4096字符限制留余量）
      let alertMessage = `${icon} <b>${levelText} Alert</b>\n\n`;
      alertMessage += `⏰ 时间: ${timeStr}\n`;
      alertMessage += `📄 文件: ${filename}\n`;
      alertMessage += `📝 消息: ${this.truncateMessage(message, 500)}\n`;

      // 如果有堆栈信息，添加简化的详细信息
      if (stack) {
        alertMessage += `\n📋 堆栈: ${this.truncateMessage(stack, 1000)}\n`;
      }

      // 确保总长度不超过3500字符
      if (alertMessage.length > 3500) {
        alertMessage = alertMessage.substring(0, 3500) + '\n\n... (消息已截断)';
      }

      // 发送通知
      await this.notify(alertMessage);

      this.log(`${levelText} alert sent: ${message.substring(0, 50)}...`);

      // 触发事件
      this.emit('error:alert', {
        level,
        message,
        timestamp,
        filePath
      });

    } catch (error) {
      this.log(`Failed to send alert: ${error.message}`, 'error');
    }
  }

  /**
   * 截断消息（避免过长）
   */
  truncateMessage(message, maxLength) {
    if (!message) return '';
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }
}

module.exports = ErrorAlert;

