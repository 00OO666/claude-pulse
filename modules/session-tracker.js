/**
 * Session Tracker Module - 会话追踪模块
 *
 * 功能：
 * 1. 追踪当前活跃的会话
 * 2. 记录会话的工作内容
 * 3. 统计会话的工作量
 * 4. 发送会话开始/结束/进度通知
 */

const HeartbeatModule = require('../module-interface');
const fs = require('fs');
const path = require('path');
const os = require('os');

class SessionTracker extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 会话状态存储
    this.sessions = new Map(); // sessionId -> sessionInfo
    this.projectsDir = path.join(os.homedir(), '.claude', 'projects');
    this.lastCheckTime = Date.now();
    this.hourlyReportInterval = 60 * 60 * 1000; // 1小时
    this.lastHourlyReport = Date.now();
  }

  /**
   * 初始化模块
   */
  async init() {
    this.log('Initializing session tracker...');

    // 加载现有会话状态
    await this.loadExistingSessions();

    // 设置lastCheckTime为当前时间，避免初始加载时发送通知
    this.lastCheckTime = Date.now();

    this.log(`Session tracker initialized, tracking ${this.sessions.size} sessions`);
  }

  /**
   * 加载现有会话
   */
  async loadExistingSessions() {
    try {
      if (!fs.existsSync(this.projectsDir)) {
        this.log('Projects directory not found, skipping session load');
        return;
      }

      const projectDirs = fs.readdirSync(this.projectsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const projectDir of projectDirs) {
        const projectPath = path.join(this.projectsDir, projectDir);
        const sessionFiles = fs.readdirSync(projectPath)
          .filter(file => file.endsWith('.jsonl') && !file.includes('sessions-index'));

        for (const sessionFile of sessionFiles) {
          const sessionId = path.basename(sessionFile, '.jsonl');
          const sessionPath = path.join(projectPath, sessionFile);
          const stats = fs.statSync(sessionPath);

          // 只加载最近24小时内活跃的会话
          const age = Date.now() - stats.mtimeMs;
          if (age < 24 * 60 * 60 * 1000) {
            await this.loadSession(sessionId, sessionPath, projectDir);
          }
        }
      }
    } catch (error) {
      this.log(`Failed to load existing sessions: ${error.message}`, 'error');
    }
  }

  /**
   * 加载单个会话
   */
  async loadSession(sessionId, sessionPath, projectDir) {
    try {
      const content = fs.readFileSync(sessionPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      if (lines.length === 0) return;

      // 解析会话信息
      const sessionInfo = {
        id: sessionId,
        projectDir: projectDir,
        path: sessionPath,
        startTime: null,
        lastActivity: null,
        cwd: null,
        gitBranch: null,
        messageCount: 0,
        toolCalls: 0,
        fileOperations: [],
        errors: 0,
        isActive: true
      };

      // 解析会话内容
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // 记录开始时间
          if (!sessionInfo.startTime && entry.timestamp) {
            sessionInfo.startTime = new Date(entry.timestamp);
          }

          // 更新最后活动时间
          if (entry.timestamp) {
            sessionInfo.lastActivity = new Date(entry.timestamp);
          }

          // 记录工作目录和分支
          if (entry.cwd) sessionInfo.cwd = entry.cwd;
          if (entry.gitBranch) sessionInfo.gitBranch = entry.gitBranch;

          // 统计消息数量
          if (entry.type === 'user' || entry.type === 'assistant') {
            sessionInfo.messageCount++;
          }

          // 统计工具调用
          if (entry.type === 'tool_use' || entry.toolUseID) {
            sessionInfo.toolCalls++;
          }

          // 记录文件操作
          if (entry.type === 'tool_result' && entry.data) {
            const toolName = entry.data.toolName || '';
            if (['Read', 'Write', 'Edit'].includes(toolName)) {
              sessionInfo.fileOperations.push({
                tool: toolName,
                timestamp: entry.timestamp
              });
            }
          }

          // 统计错误
          if (entry.type === 'error' || (entry.data && entry.data.isError)) {
            sessionInfo.errors++;
          }
        } catch (parseError) {
          // 忽略解析错误的行
        }
      }

      // 检查会话是否仍然活跃（最后活动在30分钟内）
      if (sessionInfo.lastActivity) {
        const inactiveTime = Date.now() - sessionInfo.lastActivity.getTime();
        sessionInfo.isActive = inactiveTime < 30 * 60 * 1000;
      }

      this.sessions.set(sessionId, sessionInfo);
      this.log(`Loaded session ${sessionId.substring(0, 8)}... (${sessionInfo.messageCount} messages, ${sessionInfo.toolCalls} tool calls)`);

    } catch (error) {
      this.log(`Failed to load session ${sessionId}: ${error.message}`, 'error');
    }
  }

  /**
   * 执行会话追踪任务
   */
  async execute() {
    try {
      // 扫描新会话和更新现有会话
      await this.scanSessions();

      // 检查会话状态变化
      await this.checkSessionChanges();

      // 发送每小时进度报告
      await this.sendHourlyReport();

      this.lastCheckTime = Date.now();

    } catch (error) {
      this.log(`Failed to execute session tracking: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 扫描会话
   */
  async scanSessions() {
    try {
      if (!fs.existsSync(this.projectsDir)) {
        return;
      }

      const projectDirs = fs.readdirSync(this.projectsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const projectDir of projectDirs) {
        const projectPath = path.join(this.projectsDir, projectDir);
        const sessionFiles = fs.readdirSync(projectPath)
          .filter(file => file.endsWith('.jsonl') && !file.includes('sessions-index'));

        for (const sessionFile of sessionFiles) {
          const sessionId = path.basename(sessionFile, '.jsonl');
          const sessionPath = path.join(projectPath, sessionFile);
          const stats = fs.statSync(sessionPath);

          // 检查是否是新会话或已更新的会话
          if (!this.sessions.has(sessionId)) {
            // 新会话
            await this.loadSession(sessionId, sessionPath, projectDir);
            await this.notifySessionStart(sessionId);
          } else if (stats.mtimeMs > this.lastCheckTime) {
            // 会话已更新
            const oldInfo = this.sessions.get(sessionId);
            await this.loadSession(sessionId, sessionPath, projectDir);
            const newInfo = this.sessions.get(sessionId);

            // 检查是否从不活跃变为活跃
            if (!oldInfo.isActive && newInfo.isActive) {
              await this.notifySessionResume(sessionId);
            }
          }
        }
      }
    } catch (error) {
      this.log(`Failed to scan sessions: ${error.message}`, 'error');
    }
  }

  /**
   * 检查会话状态变化
   */
  async checkSessionChanges() {
    for (const [sessionId, sessionInfo] of this.sessions.entries()) {
      // 检查会话是否变为不活跃
      if (sessionInfo.isActive && sessionInfo.lastActivity) {
        const inactiveTime = Date.now() - sessionInfo.lastActivity.getTime();
        if (inactiveTime >= 30 * 60 * 1000) {
          sessionInfo.isActive = false;
          await this.notifySessionEnd(sessionId);
        }
      }
    }
  }

  /**
   * 发送每小时进度报告
   */
  async sendHourlyReport() {
    const now = Date.now();
    if (now - this.lastHourlyReport < this.hourlyReportInterval) {
      return;
    }

    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);
    if (activeSessions.length === 0) {
      return;
    }

    let message = `📊 <b>会话进度报告</b>\n\n`;
    message += `⏰ 时间: ${this.formatTime(new Date())}\n`;
    message += `📈 活跃会话: ${activeSessions.length}\n\n`;

    for (const session of activeSessions) {
      const duration = this.formatDuration(session.startTime, session.lastActivity);
      const position = this.detectWindowPosition(session.cwd);
      const desktop = this.detectDesktop(session.cwd);
      const topic = this.extractSessionTopic(session);

      if (position) {
        message += `📍 ${desktop} - ${position}\n`;
      } else {
        message += `📍 ${desktop}\n`;
      }

      message += `📝 ${topic}\n`;
      message += `  ⏱️ 持续: ${duration}\n`;
      message += `  💬 消息: ${session.messageCount}\n`;
      message += `  🔧 工具: ${session.toolCalls}\n`;
      message += `  📝 文件: ${session.fileOperations.length}\n`;

      if (session.errors > 0) {
        message += `  ⚠️ 错误: ${session.errors}\n`;
      }

      message += `\n`;
    }

    await this.notify(message);
    this.lastHourlyReport = now;
    this.log('Hourly progress report sent');

    // 触发事件
    this.emit('session:hourly_report', { activeSessions });
  }

  /**
   * 发送会话开始通知
   */
  async notifySessionStart(sessionId) {
    const sessionInfo = this.sessions.get(sessionId);
    if (!sessionInfo) return;

    const position = this.detectWindowPosition(sessionInfo.cwd);
    const desktop = this.detectDesktop(sessionInfo.cwd);
    const topic = this.extractSessionTopic(sessionInfo);

    let message = `🚀 <b>会话开始</b>\n\n`;

    if (position) {
      message += `📍 位置: ${desktop} - ${position}\n`;
    } else {
      message += `📍 位置: ${desktop}\n`;
    }

    message += `📝 主题: ${topic}\n`;
    message += `📂 目录: ${sessionInfo.cwd || '未知'}\n`;

    if (sessionInfo.gitBranch) {
      message += `🌿 分支: ${sessionInfo.gitBranch}\n`;
    }

    message += `⏰ 时间: ${this.formatTime(sessionInfo.startTime)}\n`;
    message += `\n✅ 会话已激活，开始追踪工作内容`;

    await this.notify(message);
    this.log(`Session started: ${sessionId.substring(0, 8)}...`);

    // 触发事件
    this.emit('session:start', { sessionId, sessionInfo });
  }

  /**
   * 发送会话恢复通知
   */
  async notifySessionResume(sessionId) {
    const sessionInfo = this.sessions.get(sessionId);
    if (!sessionInfo) return;

    const position = this.detectWindowPosition(sessionInfo.cwd);
    const desktop = this.detectDesktop(sessionInfo.cwd);
    const topic = this.extractSessionTopic(sessionInfo);

    let message = `🔄 <b>会话恢复</b>\n\n`;

    if (position) {
      message += `📍 位置: ${desktop} - ${position}\n`;
    } else {
      message += `📍 位置: ${desktop}\n`;
    }

    message += `📝 主题: ${topic}\n`;
    message += `📂 目录: ${sessionInfo.cwd || '未知'}\n`;
    message += `⏰ 时间: ${this.formatTime(new Date())}\n`;
    message += `\n✅ 会话重新激活`;

    await this.notify(message);
    this.log(`Session resumed: ${sessionId.substring(0, 8)}...`);

    // 触发事件
    this.emit('session:resume', { sessionId, sessionInfo });
  }

  /**
   * 发送会话结束通知
   */
  async notifySessionEnd(sessionId) {
    const sessionInfo = this.sessions.get(sessionId);
    if (!sessionInfo) return;

    const duration = this.formatDuration(sessionInfo.startTime, sessionInfo.lastActivity);
    const position = this.detectWindowPosition(sessionInfo.cwd);
    const desktop = this.detectDesktop(sessionInfo.cwd);
    const topic = this.extractSessionTopic(sessionInfo);

    let message = `🏁 <b>会话结束</b>\n\n`;

    if (position) {
      message += `📍 位置: ${desktop} - ${position}\n`;
    } else {
      message += `📍 位置: ${desktop}\n`;
    }

    message += `📝 主题: ${topic}\n`;
    message += `📂 目录: ${sessionInfo.cwd || '未知'}\n`;
    message += `⏱️ 时长: ${duration}\n`;
    message += `\n📊 <b>工作成果</b>:\n`;
    message += `  💬 消息数量: ${sessionInfo.messageCount}\n`;
    message += `  🔧 工具调用: ${sessionInfo.toolCalls}\n`;
    message += `  📝 文件操作: ${sessionInfo.fileOperations.length}\n`;

    if (sessionInfo.errors > 0) {
      message += `  ⚠️ 错误数量: ${sessionInfo.errors}\n`;
    }

    message += `\n✅ 会话已结束`;

    await this.notify(message);
    this.log(`Session ended: ${sessionId.substring(0, 8)}...`);

    // 触发事件
    this.emit('session:end', { sessionId, sessionInfo });
  }

  /**
   * 识别窗口位置（3×3矩阵）
   * 通过工作目录推断窗口位置
   */
  detectWindowPosition(cwd) {
    if (!cwd) return null;

    // 尝试从工作目录中提取位置信息
    // 例如：F:\Project-7 → 可能是第3行第1列（7 = 2*3 + 1）
    const match = cwd.match(/Project-(\d+)|project-(\d+)|(\d+)$/i);
    if (match) {
      const num = parseInt(match[1] || match[2] || match[3]);
      if (num >= 1 && num <= 9) {
        const row = Math.ceil(num / 3);
        const col = ((num - 1) % 3) + 1;
        return `${row}-${col}`;
      }
    }

    // 如果无法推断，返回null
    return null;
  }

  /**
   * 识别桌面
   * 通过工作目录的盘符或路径推断桌面
   */
  detectDesktop(cwd) {
    if (!cwd) return '未知桌面';

    // 通过盘符推断桌面
    // F盘 → 桌面1, G盘 → 桌面2, 等等
    const drive = cwd.match(/^([A-Z]):/i);
    if (drive) {
      const driveLetter = drive[1].toUpperCase();
      if (driveLetter === 'F') return '桌面1';
      if (driveLetter === 'G') return '桌面2';
      if (driveLetter === 'H') return '桌面3';
      if (driveLetter === 'C') return '主桌面';
    }

    return '桌面1'; // 默认
  }

  /**
   * 提取会话主题
   * 从会话内容中提取主题关键词
   */
  extractSessionTopic(sessionInfo) {
    if (!sessionInfo.cwd) return '未知主题';

    // 从工作目录中提取项目名称
    const parts = sessionInfo.cwd.split(path.sep);
    const projectName = parts[parts.length - 1];

    // 清理项目名称
    const cleanName = projectName
      .replace(/^Project-\d+$/i, '项目开发')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ');

    return cleanName;
  }

  /**
   * 格式化时间
   */
  formatTime(date) {
    if (!date) return '未知';
    return new Date(date).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false
    });
  }

  /**
   * 格式化持续时间
   */
  formatDuration(startTime, endTime) {
    if (!startTime || !endTime) return '未知';

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const duration = end - start;

    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }
}

module.exports = SessionTracker;
