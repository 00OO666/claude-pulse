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

    // 用户权限配置
    this.userPermissions = config.userPermissions || {
      '6145538033': 'admin' // 默认管理员
    };

    // 命令处理器映射
    this.commandHandlers = {
      '/status': this.handleStatus.bind(this),
      '/sessions': this.handleSessions.bind(this),
      '/logs': this.handleLogs.bind(this),
      '/stats': this.handleStats.bind(this),
      '/help': this.handleHelp.bind(this),
      '/menu': this.handleMenu.bind(this),
      '/session': this.handleSessionDetail.bind(this),
      '/repeat': this.handleRepeat.bind(this)
    };

    // 回调查询处理器（内联键盘按钮）
    this.callbackHandlers = {
      'status': this.handleStatus.bind(this),
      'sessions': this.handleSessions.bind(this),
      'logs': this.handleLogs.bind(this),
      'stats': this.handleStats.bind(this),
      'help': this.handleHelp.bind(this),
      'menu': this.handleMenu.bind(this),
      'session_detail': this.handleSessionDetailCallback.bind(this),
      'logs_error': this.handleLogsError.bind(this),
      'logs_warn': this.handleLogsWarn.bind(this),
      'suggest': this.handleSuggest.bind(this)
    };

    // 命令历史（每个用户独立）
    this.commandHistory = {};

    // 命令模板
    this.commandTemplates = {
      'check_errors': '/logs error',
      'check_warnings': '/logs warn',
      'quick_status': '/status',
      'recent_sessions': '/sessions'
    };

    // 日志文件路径
    this.logsDir = path.join(os.homedir(), '.claude', 'logs');
    this.projectsDir = path.join(os.homedir(), '.claude', 'projects');

    // 自然语言命令映射
    this.nlpPatterns = [
      { pattern: /查看|看看|显示.*状态/i, command: '/status' },
      { pattern: /查看|看看|显示.*会话/i, command: '/sessions' },
      { pattern: /查看|看看|显示.*日志/i, command: '/logs' },
      { pattern: /查看|看看|显示.*统计/i, command: '/stats' },
      { pattern: /错误|error/i, command: '/logs error' },
      { pattern: /警告|warning|warn/i, command: '/logs warn' },
      { pattern: /帮助|help/i, command: '/help' },
      { pattern: /菜单|menu/i, command: '/menu' }
    ];
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
      // 处理回调查询（内联键盘按钮点击）
      if (update.callback_query) {
        await this.processCallbackQuery(update.callback_query);
        return;
      }

      // 处理语音消息
      if (update.message && update.message.voice) {
        await this.processVoiceMessage(update.message);
        return;
      }

      // 只处理文本消息
      if (!update.message || !update.message.text) {
        return;
      }

      const message = update.message;
      const chatId = message.chat.id.toString();
      const text = message.text.trim();
      const username = message.from.username || message.from.first_name || 'Unknown';

      // 验证chat_id和权限
      if (!this.allowedChatIds.includes(chatId)) {
        this.log(`Unauthorized access attempt from chat_id: ${chatId} (${username})`, 'warn');
        await this.sendMessage(chatId, '❌ 未授权访问。此Bot仅限授权用户使用。');
        return;
      }

      const userRole = this.getUserRole(chatId);

      // 记录命令
      this.log(`Received command from ${username} (${chatId}, ${userRole}): ${text}`);

      // 记录命令历史
      this.addToCommandHistory(chatId, text);

      // 尝试自然语言理解
      let command = text.split(' ')[0].toLowerCase();
      let args = text.split(' ').slice(1);

      // 如果不是标准命令，尝试NLP解析
      if (!command.startsWith('/')) {
        const nlpResult = this.parseNaturalLanguage(text);
        if (nlpResult) {
          command = nlpResult.command;
          args = nlpResult.args || [];
          this.log(`NLP parsed: "${text}" -> ${command} ${args.join(' ')}`);
        }
      }

      // 查找并执行命令处理器
      const handler = this.commandHandlers[command];

      if (handler) {
        // 检查权限
        if (this.checkPermission(chatId, command)) {
          await handler(chatId, args, username);

          // 触发命令执行事件
          this.emit('remote-control:command', {
            command,
            args,
            chatId,
            username,
            role: userRole,
            timestamp: Date.now()
          });
        } else {
          await this.sendMessage(chatId, `❌ 权限不足。你的角色 (${userRole}) 无法执行此命令。`);
        }
      } else {
        await this.sendMessage(chatId, `❌ 未知命令: ${command}\n\n使用 /help 查看可用命令，或使用 /menu 打开菜单。`);
      }
    } catch (error) {
      this.log(`Failed to process update: ${error.message}`, 'error');
    }
  }

  /**
   * 处理回调查询（内联键盘按钮点击）
   */
  async processCallbackQuery(callbackQuery) {
    try {
      const chatId = callbackQuery.message.chat.id.toString();
      const data = callbackQuery.data;
      const username = callbackQuery.from.username || callbackQuery.from.first_name || 'Unknown';

      // 验证权限
      if (!this.allowedChatIds.includes(chatId)) {
        await this.answerCallbackQuery(callbackQuery.id, '❌ 未授权访问');
        return;
      }

      this.log(`Callback query from ${username} (${chatId}): ${data}`);

      // 解析回调数据
      const [action, ...params] = data.split(':');

      // 查找并执行回调处理器
      const handler = this.callbackHandlers[action];

      if (handler) {
        // 检查权限
        if (this.checkPermission(chatId, `/${action}`)) {
          await handler(chatId, params, username);
          await this.answerCallbackQuery(callbackQuery.id, '✅ 已执行');
        } else {
          await this.answerCallbackQuery(callbackQuery.id, '❌ 权限不足');
        }
      } else {
        await this.answerCallbackQuery(callbackQuery.id, '❌ 未知操作');
      }
    } catch (error) {
      this.log(`Failed to process callback query: ${error.message}`, 'error');
      await this.answerCallbackQuery(callbackQuery.id, '❌ 处理失败');
    }
  }

  /**
   * 处理语音消息
   */
  async processVoiceMessage(message) {
    try {
      const chatId = message.chat.id.toString();
      const username = message.from.username || message.from.first_name || 'Unknown';

      // 验证权限
      if (!this.allowedChatIds.includes(chatId)) {
        await this.sendMessage(chatId, '❌ 未授权访问');
        return;
      }

      this.log(`Voice message from ${username} (${chatId})`);

      // 发送处理中提示
      await this.sendMessage(chatId, '🎤 正在处理语音消息...');

      // TODO: 实现语音转文字功能
      // 这里需要集成语音识别API（如OpenAI Whisper、Google Speech-to-Text等）
      // 暂时返回提示信息
      await this.sendMessage(chatId, '⚠️ 语音命令功能正在开发中。\n\n请使用文本命令或 /menu 打开菜单。');

    } catch (error) {
      this.log(`Failed to process voice message: ${error.message}`, 'error');
      await this.sendMessage(chatId, '❌ 语音处理失败');
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
        reply_markup: options.reply_markup,
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
   * 回答回调查询
   */
  async answerCallbackQuery(callbackQueryId, text) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      });

      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${this.botToken}/answerCallbackQuery`,
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

      // 创建内联键盘
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📋 查看会话', callback_data: 'sessions' },
            { text: '📝 查看日志', callback_data: 'logs' }
          ],
          [
            { text: '📈 查看统计', callback_data: 'stats' },
            { text: '💡 智能建议', callback_data: 'suggest' }
          ],
          [
            { text: '🔄 刷新状态', callback_data: 'status' },
            { text: '📱 主菜单', callback_data: 'menu' }
          ]
        ]
      };

      await this.sendMessage(chatId, message, { reply_markup: keyboard });
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取状态失败: ${error.message}`);
    }
  }

  /**
   * 命令处理器: /menu - 主菜单
   */
  async handleMenu(chatId, args) {
    try {
      const userRole = this.getUserRole(chatId);
      const message = `🤖 <b>Claude Pulse 远程控制</b>

👤 你的角色: <code>${userRole}</code>

请选择操作：`;

      // 创建主菜单内联键盘
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 系统状态', callback_data: 'status' },
            { text: '📋 活跃会话', callback_data: 'sessions' }
          ],
          [
            { text: '📝 查看日志', callback_data: 'logs' },
            { text: '📈 工作统计', callback_data: 'stats' }
          ],
          [
            { text: '❌ 错误日志', callback_data: 'logs_error' },
            { text: '⚠️ 警告日志', callback_data: 'logs_warn' }
          ],
          [
            { text: '💡 智能建议', callback_data: 'suggest' },
            { text: '❓ 帮助', callback_data: 'help' }
          ]
        ]
      };

      await this.sendMessage(chatId, message, { reply_markup: keyboard });
    } catch (error) {
      await this.sendMessage(chatId, `❌ 显示菜单失败: ${error.message}`);
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

      // 创建内联键盘（显示前5个会话的详情按钮）
      const keyboard = {
        inline_keyboard: []
      };

      // 添加会话详情按钮（每行2个）
      for (let i = 0; i < Math.min(sessions.length, 6); i += 2) {
        const row = [];
        row.push({
          text: `📂 ${sessions[i].name.substring(0, 15)}...`,
          callback_data: `session_detail:${sessions[i].name}`
        });
        if (i + 1 < Math.min(sessions.length, 6)) {
          row.push({
            text: `📂 ${sessions[i + 1].name.substring(0, 15)}...`,
            callback_data: `session_detail:${sessions[i + 1].name}`
          });
        }
        keyboard.inline_keyboard.push(row);
      }

      // 添加操作按钮
      keyboard.inline_keyboard.push([
        { text: '🔄 刷新', callback_data: 'sessions' },
        { text: '📱 主菜单', callback_data: 'menu' }
      ]);

      await this.sendMessage(chatId, message, { reply_markup: keyboard });
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取会话列表失败: ${error.message}`);
    }
  }

  /**
   * 命令处理器: /session - 查看会话详情
   */
  async handleSessionDetail(chatId, args, username) {
    try {
      const sessionName = args[0];
      if (!sessionName) {
        await this.sendMessage(chatId, '❌ 请指定会话名称\n\n用法: /session <会话名>');
        return;
      }

      await this.showSessionDetail(chatId, sessionName);
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取会话详情失败: ${error.message}`);
    }
  }

  /**
   * 回调处理器: 会话详情
   */
  async handleSessionDetailCallback(chatId, params, username) {
    try {
      const sessionName = params[0];
      await this.showSessionDetail(chatId, sessionName);
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取会话详情失败: ${error.message}`);
    }
  }

  /**
   * 显示会话详情
   */
  async showSessionDetail(chatId, sessionName) {
    const sessionPath = path.join(this.projectsDir, sessionName);

    if (!fs.existsSync(sessionPath)) {
      await this.sendMessage(chatId, `❌ 会话不存在: ${sessionName}`);
      return;
    }

    const stat = fs.statSync(sessionPath);
    const size = this.getDirectorySize(sessionPath);
    const timeAgo = this.formatTimeAgo(stat.mtime);

    // 读取会话文件
    const files = fs.readdirSync(sessionPath);
    const fileCount = files.length;

    let message = `📂 <b>会话详情</b>\n\n`;
    message += `📝 名称: <code>${sessionName}</code>\n`;
    message += `📅 最后修改: ${timeAgo}\n`;
    message += `💾 大小: ${this.formatBytes(size)}\n`;
    message += `📄 文件数: ${fileCount}\n\n`;

    // 列出主要文件
    if (fileCount > 0) {
      message += `<b>主要文件:</b>\n`;
      files.slice(0, 5).forEach(file => {
        message += `  • ${file}\n`;
      });
      if (fileCount > 5) {
        message += `  ... 还有 ${fileCount - 5} 个文件\n`;
      }
    }

    // 创建操作按钮
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 返回会话列表', callback_data: 'sessions' },
          { text: '📱 主菜单', callback_data: 'menu' }
        ]
      ]
    };

    await this.sendMessage(chatId, message, { reply_markup: keyboard });
  }

  /**
   * 命令处理器: /logs
   */
  async handleLogs(chatId, args) {
    try {
      const filter = args[0] || 'all'; // all, error, warn
      const limit = parseInt(args[1]) || 20;

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

      // 读取最新日志文件
      const latestLog = logFiles[0];
      const content = fs.readFileSync(latestLog.path, 'utf-8');
      let lines = content.split('\n').filter(line => line.trim());

      // 根据过滤器筛选日志
      if (filter === 'error') {
        lines = lines.filter(line => line.toLowerCase().includes('error'));
      } else if (filter === 'warn') {
        lines = lines.filter(line => line.toLowerCase().includes('warn'));
      }

      const recentLines = lines.slice(-limit);

      let filterText = filter === 'all' ? '全部' : filter === 'error' ? '错误' : '警告';
      let message = `📝 <b>最近日志</b> (${filterText}, ${latestLog.name})\n\n`;
      message += '<code>';
      message += recentLines.join('\n').substring(0, 3000); // Telegram消息长度限制
      message += '</code>';

      // 创建内联键盘
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📝 全部日志', callback_data: 'logs' },
            { text: '❌ 错误日志', callback_data: 'logs_error' }
          ],
          [
            { text: '⚠️ 警告日志', callback_data: 'logs_warn' },
            { text: '🔄 刷新', callback_data: `logs:${filter}` }
          ],
          [
            { text: '📱 主菜单', callback_data: 'menu' }
          ]
        ]
      };

      await this.sendMessage(chatId, message, { reply_markup: keyboard });
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取日志失败: ${error.message}`);
    }
  }

  /**
   * 回调处理器: 错误日志
   */
  async handleLogsError(chatId, params) {
    await this.handleLogs(chatId, ['error', '20']);
  }

  /**
   * 回调处理器: 警告日志
   */
  async handleLogsWarn(chatId, params) {
    await this.handleLogs(chatId, ['warn', '20']);
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

      // 创建内联键盘
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 系统状态', callback_data: 'status' },
            { text: '🔄 刷新统计', callback_data: 'stats' }
          ],
          [
            { text: '📱 主菜单', callback_data: 'menu' }
          ]
        ]
      };

      await this.sendMessage(chatId, message, { reply_markup: keyboard });
    } catch (error) {
      await this.sendMessage(chatId, `❌ 获取统计信息失败: ${error.message}`);
    }
  }

  /**
   * 命令处理器: /repeat - 重复上一条命令
   */
  async handleRepeat(chatId, args, username) {
    try {
      const history = this.commandHistory[chatId];
      if (!history || history.length < 2) {
        await this.sendMessage(chatId, '❌ 没有可重复的命令');
        return;
      }

      // 获取倒数第二条命令（最后一条是/repeat本身）
      const lastCommand = history[history.length - 2];

      this.log(`Repeating command for ${username}: ${lastCommand}`);

      // 解析并执行命令
      const command = lastCommand.split(' ')[0].toLowerCase();
      const cmdArgs = lastCommand.split(' ').slice(1);

      const handler = this.commandHandlers[command];
      if (handler) {
        await handler(chatId, cmdArgs, username);
      } else {
        await this.sendMessage(chatId, `❌ 无法重复命令: ${lastCommand}`);
      }
    } catch (error) {
      await this.sendMessage(chatId, `❌ 重复命令失败: ${error.message}`);
    }
  }

  /**
   * 回调处理器: 智能建议
   */
  async handleSuggest(chatId, params) {
    try {
      // 基于当前状态生成智能建议
      const suggestions = await this.generateSuggestions(chatId);

      let message = `💡 <b>智能建议</b>\n\n`;

      if (suggestions.length === 0) {
        message += '暂无建议';
      } else {
        suggestions.forEach((suggestion, index) => {
          message += `${index + 1}. ${suggestion.text}\n`;
          message += `   <i>${suggestion.reason}</i>\n\n`;
        });
      }

      // 创建内联键盘
      const keyboard = {
        inline_keyboard: []
      };

      // 为每个建议添加快捷按钮
      suggestions.slice(0, 4).forEach(suggestion => {
        keyboard.inline_keyboard.push([
          { text: suggestion.buttonText, callback_data: suggestion.action }
        ]);
      });

      keyboard.inline_keyboard.push([
        { text: '🔄 刷新建议', callback_data: 'suggest' },
        { text: '📱 主菜单', callback_data: 'menu' }
      ]);

      await this.sendMessage(chatId, message, { reply_markup: keyboard });
    } catch (error) {
      await this.sendMessage(chatId, `❌ 生成建议失败: ${error.message}`);
    }
  }

  /**
   * 命令处理器: /help
   */
  async handleHelp(chatId, args) {
    const userRole = this.getUserRole(chatId);

    const message = `🤖 <b>远程控制命令</b>

<b>基本命令:</b>
/menu - 打开主菜单（推荐）
/status - 查看Claude Code状态
/sessions - 查看活跃会话列表
/logs [类型] [行数] - 查看日志
   类型: all/error/warn
   示例: /logs error 50
/stats - 查看工作统计
/repeat - 重复上一条命令

<b>会话管理:</b>
/session <名称> - 查看会话详情

<b>自然语言:</b>
你也可以用自然语言发送命令，例如：
• "查看状态"
• "看看最近的错误"
• "显示会话列表"

<b>你的角色:</b> <code>${userRole}</code>

---
💡 提示: 使用 /menu 打开交互式菜单
🔒 此Bot仅限授权用户使用`;

    // 创建内联键盘
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 打开主菜单', callback_data: 'menu' }
        ]
      ]
    };

    await this.sendMessage(chatId, message, { reply_markup: keyboard });
  }

  /**
   * 权限管理: 获取用户角色
   */
  getUserRole(chatId) {
    return this.userPermissions[chatId] || 'viewer';
  }

  /**
   * 权限管理: 检查权限
   */
  checkPermission(chatId, command) {
    const role = this.getUserRole(chatId);

    // 定义权限级别
    const permissions = {
      admin: ['*'], // 所有命令
      user: ['/status', '/sessions', '/logs', '/stats', '/help', '/menu', '/session', '/repeat'],
      viewer: ['/status', '/help', '/menu']
    };

    const allowedCommands = permissions[role] || [];

    // admin可以执行所有命令
    if (allowedCommands.includes('*')) {
      return true;
    }

    // 检查命令是否在允许列表中
    return allowedCommands.includes(command);
  }

  /**
   * 命令历史: 添加到历史记录
   */
  addToCommandHistory(chatId, command) {
    if (!this.commandHistory[chatId]) {
      this.commandHistory[chatId] = [];
    }

    this.commandHistory[chatId].push(command);

    // 限制历史记录长度
    if (this.commandHistory[chatId].length > 50) {
      this.commandHistory[chatId].shift();
    }
  }

  /**
   * 自然语言理解: 解析自然语言命令
   */
  parseNaturalLanguage(text) {
    for (const pattern of this.nlpPatterns) {
      if (pattern.pattern.test(text)) {
        const parts = pattern.command.split(' ');
        return {
          command: parts[0],
          args: parts.slice(1)
        };
      }
    }
    return null;
  }

  /**
   * 智能建议: 生成建议
   */
  async generateSuggestions(chatId) {
    const suggestions = [];

    try {
      // 检查是否有错误日志
      if (fs.existsSync(this.logsDir)) {
        const logFiles = fs.readdirSync(this.logsDir)
          .filter(file => file.endsWith('.log'))
          .map(file => ({
            path: path.join(this.logsDir, file),
            mtime: fs.statSync(path.join(this.logsDir, file)).mtime
          }))
          .sort((a, b) => b.mtime - a.mtime);

        if (logFiles.length > 0) {
          const content = fs.readFileSync(logFiles[0].path, 'utf-8');
          const errorCount = (content.match(/error/gi) || []).length;
          const warnCount = (content.match(/warn/gi) || []).length;

          if (errorCount > 0) {
            suggestions.push({
              text: `发现 ${errorCount} 个错误日志`,
              reason: '建议查看错误日志以排查问题',
              buttonText: '❌ 查看错误',
              action: 'logs_error'
            });
          }

          if (warnCount > 0) {
            suggestions.push({
              text: `发现 ${warnCount} 个警告日志`,
              reason: '建议查看警告日志',
              buttonText: '⚠️ 查看警告',
              action: 'logs_warn'
            });
          }
        }
      }

      // 检查内存使用
      const memUsage = process.memoryUsage();
      const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      if (memUsageMB > 500) {
        suggestions.push({
          text: `内存使用较高 (${memUsageMB} MB)`,
          reason: '建议查看系统状态',
          buttonText: '📊 查看状态',
          action: 'status'
        });
      }

      // 检查运行时间
      const uptime = process.uptime();
      if (uptime > 86400) { // 超过1天
        suggestions.push({
          text: `系统已运行 ${Math.floor(uptime / 86400)} 天`,
          reason: '运行稳定，可以查看统计信息',
          buttonText: '📈 查看统计',
          action: 'stats'
        });
      }

      // 如果没有建议，添加默认建议
      if (suggestions.length === 0) {
        suggestions.push({
          text: '系统运行正常',
          reason: '可以查看当前状态',
          buttonText: '📊 查看状态',
          action: 'status'
        });
      }

    } catch (error) {
      this.log(`Failed to generate suggestions: ${error.message}`, 'error');
    }

    return suggestions;
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
