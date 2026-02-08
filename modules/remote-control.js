/**
 * Remote Control Module - 远程控制模块
 *
 * 功能：
 * 1. 通过Telegram Bot接收远程命令
 * 2. 查看Claude Code状态和统计信息
 * 3. 远程查看日志和会话信息
 * 4. 安全的命令权限控制
 */

const HeartbeatModule = require('../module-interface');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

class RemoteControl extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // Telegram Bot配置
    this.botToken = config.botToken || '';
    this.allowedChatIds = config.allowedChatIds || ['6145538033'];
    this.lastUpdateId = 0;

    // 命令处理器映射
    this.commandHandlers = {
      '/status': this.handleStatus.bind(this),
      '/sessions': this.handleSessions.bind(this),
      '/logs': this.handleLogs.bind(this),
      '/stats': this.handleStats.bind(this),
      '/help': this.handleHelp.bind(this)
    };

    // 日志文件路径
    this.logsDir = path.join(os.homedir(), '.claude', 'logs');
    this.projectsDir = path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();

    if (!this.botToken) {
      this.log('Bot token not configured, remote control disabled', 'warn');
      this.enabled = false;
      return;
    }

    this.log('Remote control module initialized');
    this.log(`Allowed chat IDs: ${this.allowedChatIds.join(', ')}`);
  }

  /**
   * 执行模块任务 - 长轮询获取Telegram消息
   */
  async execute() {
    try {
      const updates = await this.getUpdates();

      if (updates && updates.length > 0) {
        for (const update of updates) {
          await this.processUpdate(update);
        }
      }
    } catch (error) {
      this.log(`Failed to get updates: ${error.message}`, 'error');
    }
  }

  /**
   * 获取Telegram更新（长轮询）
   */
  async getUpdates() {
    return new Promise((resolve, reject) => {
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (response.ok && response.result) {
              // 更新lastUpdateId
              if (response.result.length > 0) {
                this.lastUpdateId = response.result[response.result.length - 1].update_id;
              }
              resolve(response.result);
            } else {
              this.log(`Telegram API error: ${response.description || 'Unknown error'}`, 'error');
              resolve([]);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 处理Telegram更新
   */
  async processUpdate(update) {
    try {
      // 只处理消息类型的更新
      if (!update.message || !update.message.text) {
        return;
      }

      const message = update.message;
      const chatId = message.chat.id.toString();
      const text = message.text.trim();
      const username = message.from.username || message.from.first_name || 'Unknown';

      // 验证chat_id
      if (!this.allowedChatIds.includes(chatId)) {
        this.log(`Unauthorized access attempt from chat_id: ${chatId} (${username})`, 'warn');
        await this.sendMessage(chatId, '❌ 未授权访问。此Bot仅限授权用户使用。');
        return;
      }

      // 记录命令
      this.log(`Received command from ${username} (${chatId}): ${text}`);

      // 解析命令
      const command = text.split(' ')[0].toLowerCase();
      const args = text.split(' ').slice(1);

      // 查找并执行命令处理器
      const handler = this.commandHandlers[command];

      if (handler) {
        await handler(chatId, args);

        // 触发命令执行事件
        this.emit('remote-control:command', {
          command,
          args,
          chatId,
          username,
          timestamp: Date.now()
        });
      } else {
        await this.sendMessage(chatId, `❌ 未知命令: ${command}\n\n使用 /help 查看可用命令。`);
      }
    } catch (error) {
      this.log(`Failed to process update: ${error.message}`, 'error');
    }
  }

  /**
   * 发送Telegram消息
   */
  async sendMessage(chatId, text, options = {}) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: options.parseMode || 'HTML',
        ...options
      });

      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${this.botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.ok) {
              resolve(response.result);
            } else {
              this.log(`Failed to send message: ${response.description}`, 'error');
              reject(new Error(response.description));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * 命令处理器: /status
   */
  async handleStatus(chatId, args) {
    try {
      const uptime = process.uptime();
      const uptimeStr = this.formatUptime(uptime);
      const memUsage = process.memoryUsage();
      const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      const message = `📊 <b>Claude Code 状态</b>

⏰ 运行时间: ${uptimeStr}
💾 内存使用: ${memUsageMB} MB
🖥️ 主机名: ${os.hostname()}
📁 工作目录: ${process.cwd()}
🔄 进程ID: ${process.pid}

✅ 系统运行正常`;

      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取状态失败: ${error.message}`);
    }
  }

  /**
   * 命令处理器: /sessions
   */
  async handleSessions(chatId, args) {
    try {
      // 检查projects目录是否存在
      if (!fs.existsSync(this.projectsDir)) {
        await this.sendMessage(chatId, '📋 <b>活跃会话</b>\n\n暂无活跃会话');
        return;
      }

      // 读取projects目录
      const projects = fs.readdirSync(this.projectsDir);
      const sessions = [];

      for (const project of projects) {
        const projectPath = path.join(this.projectsDir, project);
        const stat = fs.statSync(projectPath);

        if (stat.isDirectory()) {
          sessions.push({
            name: project,
            modified: stat.mtime,
            size: this.getDirectorySize(projectPath)
          });
        }
      }

      // 按修改时间排序
      sessions.sort((a, b) => b.modified - a.modified);

      // 构建消息
      let message = `📋 <b>活跃会话</b> (${sessions.length})\n\n`;

      if (sessions.length === 0) {
        message += '暂无活跃会话';
      } else {
        sessions.slice(0, 10).forEach((session, index) => {
          const timeAgo = this.formatTimeAgo(session.modified);
          message += `${index + 1}. <code>${session.name}</code>\n`;
          message += `   📅 ${timeAgo}\n`;
          message += `   💾 ${this.formatBytes(session.size)}\n\n`;
        });

        if (sessions.length > 10) {
          message += `\n... 还有 ${sessions.length - 10} 个会话`;
        }
      }

      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取会话列表失败: ${error.message}`);
    }
  }

  /**
   * 命令处理器: /logs
   */
  async handleLogs(chatId, args) {
    try {
      const limit = parseInt(args[0]) || 20;

      // 检查日志目录是否存在
      if (!fs.existsSync(this.logsDir)) {
        await this.sendMessage(chatId, '📝 <b>最近日志</b>\n\n暂无日志记录');
        return;
      }

      // 查找最新的日志文件
      const logFiles = fs.readdirSync(this.logsDir)
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logsDir, file),
          mtime: fs.statSync(path.join(this.logsDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (logFiles.length === 0) {
        await this.sendMessage(chatId, '📝 <b>最近日志</b>\n\n暂无日志文件');
        return;
      }

      // 读取最新日志文件的最后N行
      const latestLog = logFiles[0];
      const content = fs.readFileSync(latestLog.path, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const recentLines = lines.slice(-limit);

      let message = `📝 <b>最近日志</b> (${latestLog.name})\n\n`;
      message += '<code>';
      message += recentLines.join('\n').substring(0, 3000); // Telegram消息长度限制
      message += '</code>';

      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取日志失败: ${error.message}`);
    }
  }

  /**
   * 命令处理器: /stats
   */
  async handleStats(chatId, args) {
    try {
      // 获取系统统计信息
      const cpuUsage = process.cpuUsage();
      const memUsage = process.memoryUsage();

      const message = `📈 <b>工作统计</b>

💻 <b>CPU 使用</b>
   User: ${(cpuUsage.user / 1000000).toFixed(2)}s
   System: ${(cpuUsage.system / 1000000).toFixed(2)}s

💾 <b>内存使用</b>
   Heap Used: ${this.formatBytes(memUsage.heapUsed)}
   Heap Total: ${this.formatBytes(memUsage.heapTotal)}
   RSS: ${this.formatBytes(memUsage.rss)}

⏱️ <b>运行时间</b>
   ${this.formatUptime(process.uptime())}

🔢 <b>Node.js 版本</b>
   ${process.version}`;

      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取统计信息失败: ${error.message}`);
    }
  }

  /**
   * 命令处理器: /help
   */
  async handleHelp(chatId, args) {
    const message = `🤖 <b>远程控制命令</b>

<b>/status</b> - 查看Claude Code状态
   显示运行时间、内存使用等信息

<b>/sessions</b> - 查看活跃会话列表
   显示最近的项目会话

<b>/logs [行数]</b> - 查看最近的日志
   默认显示最后20行日志
   示例: /logs 50

<b>/stats</b> - 查看工作统计
   显示CPU、内存使用情况

<b>/help</b> - 显示此帮助信息

---
🔒 此Bot仅限授权用户使用`;

    await this.sendMessage(chatId, message);
  }

  /**
   * 工具方法: 格式化运行时间
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

    return parts.join(' ');
  }

  /**
   * 工具方法: 格式化时间差
   */
  formatTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date) / 1000);

    if (seconds < 60) return `${seconds}秒前`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
    return `${Math.floor(seconds / 86400)}天前`;
  }

  /**
   * 工具方法: 格式化字节数
   */
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  /**
   * 工具方法: 获取目录大小
   */
  getDirectorySize(dirPath) {
    let size = 0;

    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          size += this.getDirectorySize(filePath);
        } else {
          size += stat.size;
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }

    return size;
  }
}

module.exports = RemoteControl;
