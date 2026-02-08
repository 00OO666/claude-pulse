/**
 * Work Stats Module - 工作统计模块
 *
 * 功能：
 * 1. 统计每日工作量
 * 2. 分析Token消耗
 * 3. 生成工作报告
 * 4. 追踪会话、文件修改、工具调用、错误等指标
 */

const HeartbeatModule = require('../module-interface');
const fs = require('fs');
const path = require('path');
const os = require('os');

class WorkStats extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 数据存储路径
    this.dataDir = path.join(os.homedir(), '.claude', 'work-stats');
    this.statsFile = path.join(this.dataDir, 'stats.json');

    // 当前统计数据
    this.stats = {
      daily: {},      // 每日统计
      weekly: {},     // 每周统计
      total: {        // 总计
        sessions: 0,
        fileChanges: 0,
        toolCalls: 0,
        errors: 0,
        totalTime: 0
      }
    };

    // 当前会话信息
    this.currentSession = {
      startTime: Date.now(),
      fileChanges: 0,
      toolCalls: 0,
      errors: 0
    };

    // 报告配置
    this.dailyReportTime = config.dailyReportTime || '22:00'; // 每天22:00发送日报
    this.weeklyReportDay = config.weeklyReportDay || 0; // 周日发送周报

    // 上次报告时间
    this.lastDailyReport = null;
    this.lastWeeklyReport = null;
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();

    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      this.log('Data directory created');
    }

    // 加载历史统计数据
    await this.loadStats();

    // 设置事件监听
    this.setupEventListeners();

    this.log('Work stats module initialized');
  }

  /**
   * 加载历史统计数据
   */
  async loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, 'utf8');
        this.stats = JSON.parse(data);
        this.log('Historical stats loaded');
      } else {
        this.log('No historical stats found, starting fresh');
      }
    } catch (error) {
      this.log(`Failed to load stats: ${error.message}`, 'error');
    }
  }

  /**
   * 保存统计数据
   */
  async saveStats() {
    try {
      fs.writeFileSync(
        this.statsFile,
        JSON.stringify(this.stats, null, 2),
        'utf8'
      );
      this.log('Stats saved');
    } catch (error) {
      this.log(`Failed to save stats: ${error.message}`, 'error');
    }
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听文件变化事件
    this.on('file:change', (data) => {
      this.onFileChange(data);
    });

    // 监听工具调用事件
    this.on('tool:call', (data) => {
      this.onToolCall(data);
    });

    // 监听错误事件
    this.on('error:detected', (data) => {
      this.onError(data);
    });

    // 监听会话事件
    this.on('session:start', (data) => {
      this.onSessionStart(data);
    });

    this.on('session:end', (data) => {
      this.onSessionEnd(data);
    });

    this.log('Event listeners setup completed');
  }

  /**
   * 获取今天的日期键（YYYY-MM-DD）
   */
  getTodayKey() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * 获取本周的周键（YYYY-WW）
   */
  getWeekKey() {
    const now = new Date();
    const year = now.getFullYear();
    const week = this.getWeekNumber(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  /**
   * 获取周数
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * 初始化日统计
   */
  initDailyStats(dateKey) {
    if (!this.stats.daily[dateKey]) {
      this.stats.daily[dateKey] = {
        date: dateKey,
        sessions: 0,
        fileChanges: 0,
        toolCalls: 0,
        errors: 0,
        totalTime: 0
      };
    }
    return this.stats.daily[dateKey];
  }

  /**
   * 初始化周统计
   */
  initWeeklyStats(weekKey) {
    if (!this.stats.weekly[weekKey]) {
      this.stats.weekly[weekKey] = {
        week: weekKey,
        sessions: 0,
        fileChanges: 0,
        toolCalls: 0,
        errors: 0,
        totalTime: 0
      };
    }
    return this.stats.weekly[weekKey];
  }

  /**
   * 处理文件变化事件
   */
  onFileChange(data) {
    const dateKey = this.getTodayKey();
    const weekKey = this.getWeekKey();

    const daily = this.initDailyStats(dateKey);
    const weekly = this.initWeeklyStats(weekKey);

    daily.fileChanges++;
    weekly.fileChanges++;
    this.stats.total.fileChanges++;
    this.currentSession.fileChanges++;

    this.saveStats();
    this.log(`File change recorded: ${data?.filename || 'unknown'}`);
  }

  /**
   * 处理工具调用事件
   */
  onToolCall(data) {
    const dateKey = this.getTodayKey();
    const weekKey = this.getWeekKey();

    const daily = this.initDailyStats(dateKey);
    const weekly = this.initWeeklyStats(weekKey);

    daily.toolCalls++;
    weekly.toolCalls++;
    this.stats.total.toolCalls++;
    this.currentSession.toolCalls++;

    this.saveStats();
    this.log(`Tool call recorded: ${data?.tool || 'unknown'}`);
  }

  /**
   * 处理错误事件
   */
  onError(data) {
    const dateKey = this.getTodayKey();
    const weekKey = this.getWeekKey();

    const daily = this.initDailyStats(dateKey);
    const weekly = this.initWeeklyStats(weekKey);

    daily.errors++;
    weekly.errors++;
    this.stats.total.errors++;
    this.currentSession.errors++;

    this.saveStats();
    this.log(`Error recorded: ${data?.message || 'unknown'}`);
  }

  /**
   * 处理会话开始事件
   */
  onSessionStart(data) {
    this.currentSession = {
      startTime: Date.now(),
      fileChanges: 0,
      toolCalls: 0,
      errors: 0
    };

    const dateKey = this.getTodayKey();
    const weekKey = this.getWeekKey();

    const daily = this.initDailyStats(dateKey);
    const weekly = this.initWeeklyStats(weekKey);

    daily.sessions++;
    weekly.sessions++;
    this.stats.total.sessions++;

    this.saveStats();
    this.log('Session started');
  }

  /**
   * 处理会话结束事件
   */
  onSessionEnd(data) {
    const sessionTime = Date.now() - this.currentSession.startTime;
    const dateKey = this.getTodayKey();
    const weekKey = this.getWeekKey();

    const daily = this.initDailyStats(dateKey);
    const weekly = this.initWeeklyStats(weekKey);

    daily.totalTime += sessionTime;
    weekly.totalTime += sessionTime;
    this.stats.total.totalTime += sessionTime;

    this.saveStats();
    this.log(`Session ended (duration: ${this.formatDuration(sessionTime)})`);
  }

  /**
   * 格式化时长
   */
  formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 执行模块任务（定期检查）
   */
  async execute() {
    try {
      const now = new Date();

      // 检查是否需要发送日报
      await this.checkDailyReport(now);

      // 检查是否需要发送周报
      await this.checkWeeklyReport(now);

      this.log('Periodic check completed');
    } catch (error) {
      this.log(`Failed to execute: ${error.message}`, 'error');
    }
  }

  /**
   * 检查是否需要发送日报
   */
  async checkDailyReport(now) {
    const [hour, minute] = this.dailyReportTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 检查是否到了发送时间
    if (currentHour === hour && currentMinute >= minute && currentMinute < minute + 60) {
      const today = this.getTodayKey();

      // 避免重复发送
      if (this.lastDailyReport === today) {
        return;
      }

      await this.sendDailyReport();
      this.lastDailyReport = today;
    }
  }

  /**
   * 检查是否需要发送周报
   */
  async checkWeeklyReport(now) {
    const currentDay = now.getDay();

    // 检查是否是周报日（默认周日）
    if (currentDay === this.weeklyReportDay) {
      const currentWeek = this.getWeekKey();

      // 避免重复发送
      if (this.lastWeeklyReport === currentWeek) {
        return;
      }

      await this.sendWeeklyReport();
      this.lastWeeklyReport = currentWeek;
    }
  }

  /**
   * 发送日报
   */
  async sendDailyReport() {
    try {
      const today = this.getTodayKey();
      const stats = this.stats.daily[today];

      if (!stats) {
        this.log('No stats for today, skipping daily report');
        return;
      }

      const message = this.formatDailyReport(stats);
      await this.notify(message, { parseMode: 'HTML' });
      this.log('Daily report sent');
    } catch (error) {
      this.log(`Failed to send daily report: ${error.message}`, 'error');
    }
  }

  /**
   * 发送周报
   */
  async sendWeeklyReport() {
    try {
      const currentWeek = this.getWeekKey();
      const stats = this.stats.weekly[currentWeek];

      if (!stats) {
        this.log('No stats for this week, skipping weekly report');
        return;
      }

      const message = this.formatWeeklyReport(stats);
      await this.notify(message, { parseMode: 'HTML' });
      this.log('Weekly report sent');
    } catch (error) {
      this.log(`Failed to send weekly report: ${error.message}`, 'error');
    }
  }

  /**
   * 格式化日报
   */
  formatDailyReport(stats) {
    return `
<b>📊 每日工作统计报告</b>

📅 日期: ${stats.date}

<b>工作量统计：</b>
• 会话数量: ${stats.sessions}
• 文件修改: ${stats.fileChanges}
• 工具调用: ${stats.toolCalls}
• 错误次数: ${stats.errors}
• 工作时长: ${this.formatDuration(stats.totalTime)}

<b>当前会话：</b>
• 文件修改: ${this.currentSession.fileChanges}
• 工具调用: ${this.currentSession.toolCalls}
• 错误次数: ${this.currentSession.errors}
• 会话时长: ${this.formatDuration(Date.now() - this.currentSession.startTime)}
    `.trim();
  }

  /**
   * 格式化周报
   */
  formatWeeklyReport(stats) {
    return `
<b>📊 每周工作统计报告</b>

📅 周次: ${stats.week}

<b>工作量统计：</b>
• 会话数量: ${stats.sessions}
• 文件修改: ${stats.fileChanges}
• 工具调用: ${stats.toolCalls}
• 错误次数: ${stats.errors}
• 工作时长: ${this.formatDuration(stats.totalTime)}

<b>总计统计：</b>
• 总会话数: ${this.stats.total.sessions}
• 总文件修改: ${this.stats.total.fileChanges}
• 总工具调用: ${this.stats.total.toolCalls}
• 总错误次数: ${this.stats.total.errors}
• 总工作时长: ${this.formatDuration(this.stats.total.totalTime)}
    `.trim();
  }

  /**
   * 获取实时统计
   */
  getRealTimeStats() {
    const today = this.getTodayKey();
    const currentWeek = this.getWeekKey();

    return {
      today: this.stats.daily[today] || this.initDailyStats(today),
      week: this.stats.weekly[currentWeek] || this.initWeeklyStats(currentWeek),
      total: this.stats.total,
      currentSession: {
        ...this.currentSession,
        duration: Date.now() - this.currentSession.startTime
      }
    };
  }
}

module.exports = WorkStats;
