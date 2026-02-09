/**
 * Work Analytics Module - 深度工作分析模块
 *
 * 功能：
 * 1. 深度工作分析 - 分析工作效率和专注时间
 * 2. 目标设定和追踪 - 设定工作目标并追踪完成情况
 * 3. 成本分析 - 详细的Token消耗分析和成本预测
 * 4. 生产力报告 - 生成详细的生产力分析报告
 * 5. 成就系统 - 激励用户提高工作效率
 */

const HeartbeatModule = require('../module-interface');
const fs = require('fs');
const path = require('path');
const os = require('os');

class WorkAnalytics extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 数据存储路径
    this.dataDir = path.join(os.homedir(), '.claude', 'work-analytics');
    this.analyticsFile = path.join(this.dataDir, 'analytics.json');
    this.goalsFile = path.join(this.dataDir, 'goals.json');
    this.achievementsFile = path.join(this.dataDir, 'achievements.json');
    this.costFile = path.join(this.dataDir, 'cost-analysis.json');

    // 深度工作分析数据
    this.analytics = {
      sessions: [],           // 会话记录
      focusTime: {},          // 专注时间统计
      productivity: {},       // 生产力指标
      patterns: {}            // 工作模式
    };

    // 目标追踪
    this.goals = {
      daily: [],
      weekly: [],
      monthly: [],
      custom: []
    };

    // 成就系统
    this.achievements = {
      unlocked: [],
      progress: {}
    };

    // 成本分析
    this.costAnalysis = {
      tokenUsage: {},         // Token使用统计
      costByModel: {},        // 按模型统计成本
      costByFeature: {},      // 按功能统计成本
      predictions: {}         // 成本预测
    };

    // 当前会话追踪
    this.currentSession = {
      startTime: null,
      focusBlocks: [],
      interruptions: 0,
      productivity: 0
    };

    // 配置
    this.focusThreshold = config.focusThreshold || 300000; // 5分钟无中断视为专注
    this.tokenCostPerK = config.tokenCostPerK || {
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002,
      'claude-3-opus': 0.015,
      'claude-3-sonnet': 0.003
    };
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

    // 加载数据
    await this.loadAnalytics();
    await this.loadGoals();
    await this.loadAchievements();
    await this.loadCostAnalysis();

    // 设置事件监听
    this.setupEventListeners();

    // 初始化成就系统
    this.initAchievements();

    this.log('Work analytics module initialized');
  }

  /**
   * 加载分析数据
   */
  async loadAnalytics() {
    try {
      if (fs.existsSync(this.analyticsFile)) {
        const data = fs.readFileSync(this.analyticsFile, 'utf8');
        this.analytics = JSON.parse(data);
        this.log('Analytics data loaded');
      }
    } catch (error) {
      this.log(`Failed to load analytics: ${error.message}`, 'error');
    }
  }

  /**
   * 保存分析数据
   */
  async saveAnalytics() {
    try {
      fs.writeFileSync(
        this.analyticsFile,
        JSON.stringify(this.analytics, null, 2),
        'utf8'
      );
    } catch (error) {
      this.log(`Failed to save analytics: ${error.message}`, 'error');
    }
  }

  /**
   * 加载目标
   */
  async loadGoals() {
    try {
      if (fs.existsSync(this.goalsFile)) {
        const data = fs.readFileSync(this.goalsFile, 'utf8');
        this.goals = JSON.parse(data);
        this.log('Goals loaded');
      }
    } catch (error) {
      this.log(`Failed to load goals: ${error.message}`, 'error');
    }
  }

  /**
   * 保存目标
   */
  async saveGoals() {
    try {
      fs.writeFileSync(
        this.goalsFile,
        JSON.stringify(this.goals, null, 2),
        'utf8'
      );
    } catch (error) {
      this.log(`Failed to save goals: ${error.message}`, 'error');
    }
  }

  /**
   * 加载成就
   */
  async loadAchievements() {
    try {
      if (fs.existsSync(this.achievementsFile)) {
        const data = fs.readFileSync(this.achievementsFile, 'utf8');
        this.achievements = JSON.parse(data);
        this.log('Achievements loaded');
      }
    } catch (error) {
      this.log(`Failed to load achievements: ${error.message}`, 'error');
    }
  }

  /**
   * 保存成就
   */
  async saveAchievements() {
    try {
      fs.writeFileSync(
        this.achievementsFile,
        JSON.stringify(this.achievements, null, 2),
        'utf8'
      );
    } catch (error) {
      this.log(`Failed to save achievements: ${error.message}`, 'error');
    }
  }

  /**
   * 加载成本分析
   */
  async loadCostAnalysis() {
    try {
      if (fs.existsSync(this.costFile)) {
        const data = fs.readFileSync(this.costFile, 'utf8');
        this.costAnalysis = JSON.parse(data);
        this.log('Cost analysis loaded');
      }
    } catch (error) {
      this.log(`Failed to load cost analysis: ${error.message}`, 'error');
    }
  }

  /**
   * 保存成本分析
   */
  async saveCostAnalysis() {
    try {
      fs.writeFileSync(
        this.costFile,
        JSON.stringify(this.costAnalysis, null, 2),
        'utf8'
      );
    } catch (error) {
      this.log(`Failed to save cost analysis: ${error.message}`, 'error');
    }
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听会话事件
    this.on('session:start', (data) => this.onSessionStart(data));
    this.on('session:end', (data) => this.onSessionEnd(data));

    // 监听活动事件
    this.on('activity:detected', (data) => this.onActivity(data));
    this.on('activity:idle', (data) => this.onIdle(data));

    // 监听Token使用事件
    this.on('token:usage', (data) => this.onTokenUsage(data));

    // 监听目标完成事件
    this.on('goal:completed', (data) => this.onGoalCompleted(data));
  }

  /**
   * 初始化成就系统
   */
  initAchievements() {
    // 定义成就列表
    this.achievementDefinitions = [
      {
        id: 'first_session',
        name: '初次启动',
        description: '完成第一个工作会话',
        icon: '🎯',
        condition: (stats) => stats.totalSessions >= 1
      },
      {
        id: 'focus_master',
        name: '专注大师',
        description: '连续专注工作2小时',
        icon: '🧘',
        condition: (stats) => stats.maxFocusTime >= 7200000
      },
      {
        id: 'early_bird',
        name: '早起的鸟儿',
        description: '在早上6点前开始工作',
        icon: '🌅',
        condition: (stats) => stats.earlyStarts >= 1
      },
      {
        id: 'night_owl',
        name: '夜猫子',
        description: '在晚上11点后工作',
        icon: '🦉',
        condition: (stats) => stats.lateWork >= 1
      },
      {
        id: 'productive_week',
        name: '高效一周',
        description: '一周内完成50个任务',
        icon: '📈',
        condition: (stats) => stats.weeklyTasks >= 50
      },
      {
        id: 'cost_optimizer',
        name: '成本优化师',
        description: '单日Token成本低于$1',
        icon: '💰',
        condition: (stats) => stats.dailyCost < 1
      }
    ];
  }

  /**
   * 处理会话开始
   */
  onSessionStart(data) {
    this.currentSession = {
      startTime: Date.now(),
      focusBlocks: [],
      interruptions: 0,
      productivity: 0,
      lastActivity: Date.now()
    };

    this.log('Session started, tracking focus time');
  }

  /**
   * 处理会话结束
   */
  onSessionEnd(data) {
    const session = {
      ...this.currentSession,
      endTime: Date.now(),
      duration: Date.now() - this.currentSession.startTime
    };

    // 计算专注时间
    const focusTime = this.calculateFocusTime(session);
    session.focusTime = focusTime;

    // 计算生产力得分
    session.productivity = this.calculateProductivity(session);

    // 保存会话记录
    this.analytics.sessions.push(session);

    // 更新统计
    this.updateAnalytics(session);

    // 检查成就
    this.checkAchievements();

    // 保存数据
    this.saveAnalytics();

    this.log(`Session ended (focus: ${this.formatDuration(focusTime)}, productivity: ${session.productivity.toFixed(2)})`);
  }

  /**
   * 处理活动检测
   */
  onActivity(data) {
    if (this.currentSession.startTime) {
      const timeSinceLastActivity = Date.now() - this.currentSession.lastActivity;

      // 如果距离上次活动超过阈值，记录为中断
      if (timeSinceLastActivity > this.focusThreshold) {
        this.currentSession.interruptions++;
      }

      this.currentSession.lastActivity = Date.now();
    }
  }

  /**
   * 处理空闲检测
   */
  onIdle(data) {
    // 空闲时间超过阈值，结束当前专注块
    if (this.currentSession.startTime) {
      const focusBlock = {
        start: this.currentSession.lastActivity,
        end: Date.now(),
        duration: Date.now() - this.currentSession.lastActivity
      };

      if (focusBlock.duration >= this.focusThreshold) {
        this.currentSession.focusBlocks.push(focusBlock);
      }
    }
  }

  /**
   * 处理Token使用
   */
  onTokenUsage(data) {
    const { model, inputTokens, outputTokens, cost } = data;
    const dateKey = this.getTodayKey();

    // 初始化日期记录
    if (!this.costAnalysis.tokenUsage[dateKey]) {
      this.costAnalysis.tokenUsage[dateKey] = {
        date: dateKey,
        totalTokens: 0,
        totalCost: 0,
        byModel: {}
      };
    }

    const dayStats = this.costAnalysis.tokenUsage[dateKey];

    // 更新总计
    dayStats.totalTokens += (inputTokens + outputTokens);
    dayStats.totalCost += cost;

    // 按模型统计
    if (!dayStats.byModel[model]) {
      dayStats.byModel[model] = {
        tokens: 0,
        cost: 0,
        calls: 0
      };
    }

    dayStats.byModel[model].tokens += (inputTokens + outputTokens);
    dayStats.byModel[model].cost += cost;
    dayStats.byModel[model].calls++;

    // 保存
    this.saveCostAnalysis();

    this.log(`Token usage recorded: ${inputTokens + outputTokens} tokens, $${cost.toFixed(4)}`);
  }

  /**
   * 处理目标完成
   */
  onGoalCompleted(data) {
    const { goalId, type } = data;

    // 查找目标
    const goal = this.findGoal(goalId, type);

    if (goal) {
      goal.completed = true;
      goal.completedAt = Date.now();

      this.saveGoals();

      // 发送通知
      this.notify(`🎉 目标完成: ${goal.title}`, {
        type: 'goal_completed',
        priority: 'normal'
      });

      // 检查成就
      this.checkAchievements();
    }
  }

  /**
   * 计算专注时间
   */
  calculateFocusTime(session) {
    return session.focusBlocks.reduce((total, block) => total + block.duration, 0);
  }

  /**
   * 计算生产力得分
   */
  calculateProductivity(session) {
    const { duration, focusTime, interruptions } = session;

    if (duration === 0) return 0;

    // 基础得分：专注时间占比
    const focusRatio = focusTime / duration;

    // 中断惩罚
    const interruptionPenalty = Math.max(0, 1 - (interruptions * 0.1));

    // 最终得分
    return focusRatio * interruptionPenalty * 100;
  }

  /**
   * 更新分析数据
   */
  updateAnalytics(session) {
    const dateKey = this.getTodayKey();
    const hour = new Date(session.startTime).getHours();

    // 更新专注时间统计
    if (!this.analytics.focusTime[dateKey]) {
      this.analytics.focusTime[dateKey] = {
        date: dateKey,
        totalFocus: 0,
        sessions: 0,
        avgProductivity: 0
      };
    }

    const dayStats = this.analytics.focusTime[dateKey];
    dayStats.totalFocus += session.focusTime;
    dayStats.sessions++;
    dayStats.avgProductivity = (dayStats.avgProductivity * (dayStats.sessions - 1) + session.productivity) / dayStats.sessions;

    // 更新工作模式
    if (!this.analytics.patterns[hour]) {
      this.analytics.patterns[hour] = {
        hour,
        sessions: 0,
        totalProductivity: 0,
        avgProductivity: 0
      };
    }

    const hourStats = this.analytics.patterns[hour];
    hourStats.sessions++;
    hourStats.totalProductivity += session.productivity;
    hourStats.avgProductivity = hourStats.totalProductivity / hourStats.sessions;
  }

  /**
   * 检查成就
   */
  checkAchievements() {
    const stats = this.calculateStats();

    this.achievementDefinitions.forEach(achievement => {
      // 如果已解锁，跳过
      if (this.achievements.unlocked.includes(achievement.id)) {
        return;
      }

      // 检查条件
      if (achievement.condition(stats)) {
        this.unlockAchievement(achievement);
      }
    });
  }

  /**
   * 解锁成就
   */
  unlockAchievement(achievement) {
    this.achievements.unlocked.push(achievement.id);
    this.saveAchievements();

    // 发送通知
    this.notify(`${achievement.icon} 成就解锁: ${achievement.name}\n${achievement.description}`, {
      type: 'achievement',
      priority: 'normal'
    });

    this.log(`Achievement unlocked: ${achievement.name}`);
  }

  /**
   * 计算统计数据
   */
  calculateStats() {
    const stats = {
      totalSessions: this.analytics.sessions.length,
      maxFocusTime: 0,
      earlyStarts: 0,
      lateWork: 0,
      weeklyTasks: 0,
      dailyCost: 0
    };

    // 计算最大专注时间
    this.analytics.sessions.forEach(session => {
      if (session.focusTime > stats.maxFocusTime) {
        stats.maxFocusTime = session.focusTime;
      }

      const hour = new Date(session.startTime).getHours();
      if (hour < 6) stats.earlyStarts++;
      if (hour >= 23) stats.lateWork++;
    });

    // 计算本周任务数（简化）
    const weekKey = this.getWeekKey();
    stats.weeklyTasks = this.goals.weekly.filter(g => g.completed && g.weekKey === weekKey).length;

    // 计算今日成本
    const today = this.getTodayKey();
    if (this.costAnalysis.tokenUsage[today]) {
      stats.dailyCost = this.costAnalysis.tokenUsage[today].totalCost;
    }

    return stats;
  }

  /**
   * 添加目标
   */
  addGoal(type, goal) {
    const newGoal = {
      id: this.generateId(),
      ...goal,
      createdAt: Date.now(),
      completed: false,
      progress: 0
    };

    if (type === 'daily') {
      newGoal.dateKey = this.getTodayKey();
    } else if (type === 'weekly') {
      newGoal.weekKey = this.getWeekKey();
    }

    this.goals[type].push(newGoal);
    this.saveGoals();

    return newGoal;
  }

  /**
   * 更新目标进度
   */
  updateGoalProgress(goalId, type, progress) {
    const goal = this.findGoal(goalId, type);

    if (goal) {
      goal.progress = progress;

      if (progress >= 100 && !goal.completed) {
        goal.completed = true;
        goal.completedAt = Date.now();

        this.emit('goal:completed', { goalId, type });
      }

      this.saveGoals();
    }
  }

  /**
   * 查找目标
   */
  findGoal(goalId, type) {
    return this.goals[type].find(g => g.id === goalId);
  }

  /**
   * 生成成本预测
   */
  generateCostPrediction() {
    const recentDays = 7;
    const today = this.getTodayKey();
    const costs = [];

    // 收集最近7天的成本数据
    for (let i = 0; i < recentDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      if (this.costAnalysis.tokenUsage[dateKey]) {
        costs.push(this.costAnalysis.tokenUsage[dateKey].totalCost);
      }
    }

    if (costs.length === 0) {
      return null;
    }

    // 计算平均值
    const avgDailyCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;

    // 预测
    return {
      dailyAverage: avgDailyCost,
      weeklyEstimate: avgDailyCost * 7,
      monthlyEstimate: avgDailyCost * 30,
      trend: this.calculateTrend(costs)
    };
  }

  /**
   * 计算趋势
   */
  calculateTrend(values) {
    if (values.length < 2) return 'stable';

    const recent = values.slice(0, Math.floor(values.length / 2));
    const older = values.slice(Math.floor(values.length / 2));

    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * 生成生产力报告
   */
  generateProductivityReport() {
    const stats = this.calculateStats();
    const prediction = this.generateCostPrediction();
    const today = this.getTodayKey();

    const report = {
      date: today,
      summary: {
        totalSessions: stats.totalSessions,
        avgProductivity: this.calculateAvgProductivity(),
        totalFocusTime: this.calculateTotalFocusTime(),
        achievements: this.achievements.unlocked.length
      },
      goals: {
        daily: this.goals.daily.filter(g => g.dateKey === today),
        weekly: this.goals.weekly.filter(g => g.weekKey === this.getWeekKey())
      },
      cost: prediction,
      patterns: this.analyzeBestWorkingHours()
    };

    return report;
  }

  /**
   * 计算平均生产力
   */
  calculateAvgProductivity() {
    if (this.analytics.sessions.length === 0) return 0;

    const total = this.analytics.sessions.reduce((sum, s) => sum + s.productivity, 0);
    return total / this.analytics.sessions.length;
  }

  /**
   * 计算总专注时间
   */
  calculateTotalFocusTime() {
    return this.analytics.sessions.reduce((sum, s) => sum + s.focusTime, 0);
  }

  /**
   * 分析最佳工作时段
   */
  analyzeBestWorkingHours() {
    const hours = Object.values(this.analytics.patterns);

    if (hours.length === 0) return null;

    // 按生产力排序
    hours.sort((a, b) => b.avgProductivity - a.avgProductivity);

    return {
      best: hours[0],
      worst: hours[hours.length - 1],
      top3: hours.slice(0, 3)
    };
  }

  /**
   * 执行模块任务
   */
  async execute() {
    try {
      // 检查目标进度
      this.checkGoalDeadlines();

      // 生成每日报告
      await this.checkDailyReport();

      this.log('Periodic check completed');
    } catch (error) {
      this.log(`Failed to execute: ${error.message}`, 'error');
    }
  }

  /**
   * 检查目标截止日期
   */
  checkGoalDeadlines() {
    const now = Date.now();

    ['daily', 'weekly', 'monthly', 'custom'].forEach(type => {
      this.goals[type].forEach(goal => {
        if (goal.deadline && !goal.completed) {
          const timeLeft = goal.deadline - now;

          // 即将到期（1小时内）
          if (timeLeft > 0 && timeLeft < 3600000 && !goal.notified) {
            this.notify(`⏰ 目标即将到期: ${goal.title}\n剩余时间: ${this.formatDuration(timeLeft)}`, {
              type: 'goal_deadline',
              priority: 'high'
            });

            goal.notified = true;
            this.saveGoals();
          }
        }
      });
    });
  }

  /**
   * 检查是否需要发送每日报告
   */
  async checkDailyReport() {
    // 每天晚上10点发送报告
    const now = new Date();
    const hour = now.getHours();

    if (hour === 22 && !this.dailyReportSent) {
      const report = this.generateProductivityReport();
      const message = this.formatProductivityReport(report);

      await this.notify(message, {
        type: 'daily_report',
        priority: 'normal',
        parseMode: 'HTML'
      });

      this.dailyReportSent = true;
    } else if (hour !== 22) {
      this.dailyReportSent = false;
    }
  }

  /**
   * 格式化生产力报告
   */
  formatProductivityReport(report) {
    const { summary, goals, cost, patterns } = report;

    let message = `<b>📊 每日生产力报告</b>\n\n`;

    message += `<b>工作概况：</b>\n`;
    message += `• 会话数量: ${summary.totalSessions}\n`;
    message += `• 平均生产力: ${summary.avgProductivity.toFixed(1)}%\n`;
    message += `• 专注时间: ${this.formatDuration(summary.totalFocusTime)}\n`;
    message += `• 解锁成就: ${summary.achievements}\n\n`;

    if (goals.daily.length > 0) {
      const completed = goals.daily.filter(g => g.completed).length;
      message += `<b>今日目标：</b>\n`;
      message += `• 完成: ${completed}/${goals.daily.length}\n\n`;
    }

    if (cost) {
      message += `<b>成本分析：</b>\n`;
      message += `• 今日成本: $${cost.dailyAverage.toFixed(2)}\n`;
      message += `• 本周预估: $${cost.weeklyEstimate.toFixed(2)}\n`;
      message += `• 趋势: ${this.getTrendEmoji(cost.trend)} ${cost.trend}\n\n`;
    }

    if (patterns && patterns.best) {
      message += `<b>最佳工作时段：</b>\n`;
      message += `• ${patterns.best.hour}:00 (生产力: ${patterns.best.avgProductivity.toFixed(1)}%)\n`;
    }

    return message;
  }

  /**
   * 获取趋势表情
   */
  getTrendEmoji(trend) {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      default: return '➡️';
    }
  }

  /**
   * 格式化时长
   */
  formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * 获取今天的日期键
   */
  getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 获取本周的周键
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
   * 生成ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      sessions: this.analytics.sessions.length,
      goals: {
        daily: this.goals.daily.length,
        weekly: this.goals.weekly.length,
        completed: this.goals.daily.filter(g => g.completed).length + this.goals.weekly.filter(g => g.completed).length
      },
      achievements: this.achievements.unlocked.length,
      cost: this.generateCostPrediction()
    };
  }
}

module.exports = WorkAnalytics;