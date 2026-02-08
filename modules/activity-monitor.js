/**
 * Activity Monitor Module - 活动监控模块
 *
 * 功能：
 * 1. 监控Claude Code活动状态
 * 2. 检测会话活动和文件变化
 * 3. 发送活动告警和心跳消息
 * 4. 追踪会话统计信息
 */

const HeartbeatModule = require('../module-interface');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ActivityMonitor extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 活动状态追踪
    this.lastActivityTime = Date.now();
    this.lastAlertTime = 0;
    this.fileWatchers = [];
    this.activityStats = {
      fileChanges: 0,
      lastFileChange: null,
      activeSessions: new Set(),
      sessionStartTime: Date.now()
    };

    // 配置
    this.inactivityThreshold = config.inactivityThreshold || 30 * 60 * 1000; // 30分钟
    this.alertCooldown = config.alertCooldown || 10 * 60 * 1000; // 10分钟冷却
    this.projectsDir = path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();

    // 设置文件监控
    await this.setupFileWatchers();

    this.log('Activity monitor initialized with file watchers');
  }

  /**
   * 设置文件监控
   */
  async setupFileWatchers() {
    try {
      // 检查projects目录是否存在
      if (!fs.existsSync(this.projectsDir)) {
        this.log(`Projects directory not found: ${this.projectsDir}`, 'warn');
        return;
      }

      // 监控projects目录
      const watcher = fs.watch(this.projectsDir, { recursive: true }, (eventType, filename) => {
        if (filename) {
          this.onFileChange(eventType, filename);
        }
      });

      this.fileWatchers.push(watcher);
      this.log(`Watching directory: ${this.projectsDir}`);

    } catch (error) {
      this.log(`Failed to setup file watchers: ${error.message}`, 'error');
    }
  }

  /**
   * 文件变化处理
   */
  onFileChange(eventType, filename) {
    const now = Date.now();
    this.lastActivityTime = now;
    this.activityStats.fileChanges++;
    this.activityStats.lastFileChange = {
      time: now,
      type: eventType,
      file: filename
    };

    // 检测会话变化
    this.detectSessionChanges(filename);

    // 触发活动事件
    this.emit('activity:file-change', {
      eventType,
      filename,
      timestamp: now
    });

    this.log(`File change detected: ${eventType} - ${filename}`, 'debug');
  }

  /**
   * 检测会话变化
   */
  detectSessionChanges(filename) {
    // 检测新会话（新的项目目录）
    if (filename.includes('project-') || filename.includes('session-')) {
      const sessionId = this.extractSessionId(filename);
      if (sessionId && !this.activityStats.activeSessions.has(sessionId)) {
        this.activityStats.activeSessions.add(sessionId);
        this.onNewSession(sessionId);
      }
    }
  }

  /**
   * 提取会话ID
   */
  extractSessionId(filename) {
    const match = filename.match(/project-(\w+)|session-(\w+)/);
    return match ? (match[1] || match[2]) : null;
  }

  /**
   * 新会话开始处理
   */
  async onNewSession(sessionId) {
    const message = `🆕 <b>新会话开始</b>

📋 会话ID: ${sessionId}
⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}
📊 活跃会话数: ${this.activityStats.activeSessions.size}

✅ Claude Code 已启动新会话`;

    try {
      await this.notify(message);
      this.log(`New session detected: ${sessionId}`);
      this.emit('activity:new-session', { sessionId, timestamp: Date.now() });
    } catch (error) {
      this.log(`Failed to send new session notification: ${error.message}`, 'error');
    }
  }

  /**
   * 执行活动监控任务
   */
  async execute() {
    try {
      const now = Date.now();
      const inactiveTime = now - this.lastActivityTime;
      const timeSinceLastAlert = now - this.lastAlertTime;

      // 检查是否需要发送不活跃告警
      if (inactiveTime > this.inactivityThreshold && timeSinceLastAlert > this.alertCooldown) {
        await this.sendInactivityAlert(inactiveTime);
        this.lastAlertTime = now;
        return;
      }

      // 发送正常心跳
      await this.sendHeartbeat();

      // 触发事件
      this.emit('activity:heartbeat', {
        timestamp: now,
        stats: this.getActivityStats()
      });

    } catch (error) {
      this.log(`Failed to execute activity monitor: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 发送不活跃告警
   */
  async sendInactivityAlert(inactiveTime) {
    const inactiveMinutes = Math.floor(inactiveTime / 60000);
    const info = this.core.getSystemInfo();

    const message = `⚠️ <b>活动告警</b>

🔴 状态: 长时间无活动
⏱️ 无活动时长: ${inactiveMinutes} 分钟
⏰ 最后活动: ${new Date(this.lastActivityTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}

💻 主机: ${info.hostname}
📂 目录: ${info.cwd}

⚠️ 请检查 Claude Code 是否正常运行`;

    await this.notify(message);
    this.log(`Inactivity alert sent (${inactiveMinutes} minutes)`);
    this.emit('activity:inactivity-alert', { inactiveTime, timestamp: Date.now() });
  }

  /**
   * 发送心跳消息
   */
  async sendHeartbeat() {
    const info = this.core.getSystemInfo();
    const stats = this.getActivityStats();
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false
    });

    const message = `💓 <b>Claude Code 心跳</b>

⏰ 时间: ${timeStr}
💻 主机: ${info.hostname}
📂 目录: ${info.cwd}
⏱️ 运行: ${info.uptime}
💾 内存: ${info.memory}

📊 <b>活动统计</b>
📝 文件变化: ${stats.fileChanges} 次
📋 活跃会话: ${stats.activeSessions} 个
⏱️ 会话时长: ${stats.sessionDuration}
🕐 最后活动: ${stats.lastActivity}

✅ 状态: 正常运行`;

    await this.notify(message);
    this.log('Activity heartbeat sent successfully');
  }

  /**
   * 获取活动统计信息
   */
  getActivityStats() {
    const now = Date.now();
    const sessionDuration = now - this.activityStats.sessionStartTime;
    const lastActivity = this.activityStats.lastFileChange
      ? new Date(this.activityStats.lastFileChange.time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
      : '无';

    return {
      fileChanges: this.activityStats.fileChanges,
      activeSessions: this.activityStats.activeSessions.size,
      sessionDuration: this.formatDuration(sessionDuration),
      lastActivity: lastActivity,
      lastFileChange: this.activityStats.lastFileChange
    };
  }

  /**
   * 格式化时长
   */
  formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}小时${minutes}分钟`;
  }

  /**
   * 销毁模块
   */
  async destroy() {
    // 关闭所有文件监控
    for (const watcher of this.fileWatchers) {
      try {
        watcher.close();
      } catch (error) {
        this.log(`Failed to close file watcher: ${error.message}`, 'error');
      }
    }
    this.fileWatchers = [];

    await super.destroy();
    this.log('Activity monitor destroyed, file watchers closed');
  }
}

module.exports = ActivityMonitor;
