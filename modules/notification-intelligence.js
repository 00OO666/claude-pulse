/**
 * Notification Intelligence Module - 智能通知模块
 *
 * 功能：
 * 1. AI学习用户偏好，自动优化路由规则
 * 2. 智能免打扰模式
 * 3. 通知聚合和批量发送
 * 4. 交互式通知
 * 5. 支持更多通知渠道（微信企业号、钉钉、飞书、企业微信）
 */

const HeartbeatModule = require('../module-interface');
const fs = require('fs');
const path = require('path');
const os = require('os');

class NotificationIntelligence extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 数据存储路径
    this.dataDir = path.join(os.homedir(), '.claude', 'notification-intelligence');
    this.preferencesFile = path.join(this.dataDir, 'preferences.json');
    this.historyFile = path.join(this.dataDir, 'history.json');

    // 用户偏好数据（AI学习）
    this.preferences = {
      channelPreferences: {},  // 渠道偏好
      timePreferences: {},     // 时间偏好
      typePreferences: {},     // 类型偏好
      aggregationRules: []     // 聚合规则
    };

    // 通知历史
    this.history = [];
    this.maxHistorySize = config.maxHistorySize || 1000;

    // 免打扰模式配置
    this.dndMode = {
      enabled: config.dndMode?.enabled || false,
      schedule: config.dndMode?.schedule || {
        workHours: { start: '09:00', end: '18:00' },
        sleepHours: { start: '23:00', end: '07:00' }
      },
      exceptions: config.dndMode?.exceptions || ['critical', 'error'],
      autoDetect: config.dndMode?.autoDetect !== false
    };

    // 通知聚合配置
    this.aggregation = {
      enabled: config.aggregation?.enabled !== false,
      window: config.aggregation?.window || 300000, // 5分钟聚合窗口
      maxSize: config.aggregation?.maxSize || 10,
      similarityThreshold: config.aggregation?.similarityThreshold || 0.7
    };

    // 待聚合的通知队列
    this.pendingNotifications = [];
    this.aggregationTimer = null;

    // 交互式通知配置
    this.interactive = {
      enabled: config.interactive?.enabled !== false,
      actions: config.interactive?.actions || []
    };

    // 新增通知渠道配置
    this.channels = {
      wechatWork: config.wechatWork || null,
      dingtalk: config.dingtalk || null,
      feishu: config.feishu || null,
      wecom: config.wecom || null
    };

    // AI学习配置
    this.aiLearning = {
      enabled: config.aiLearning?.enabled !== false,
      minSamples: config.aiLearning?.minSamples || 50,
      learningRate: config.aiLearning?.learningRate || 0.1
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

    // 加载用户偏好和历史
    await this.loadPreferences();
    await this.loadHistory();

    // 初始化通知渠道
    await this.initChannels();

    // 设置事件监听
    this.setupEventListeners();

    this.log('Notification intelligence module initialized');
  }

  /**
   * 加载用户偏好
   */
  async loadPreferences() {
    try {
      if (fs.existsSync(this.preferencesFile)) {
        const data = fs.readFileSync(this.preferencesFile, 'utf8');
        this.preferences = JSON.parse(data);
        this.log('User preferences loaded');
      }
    } catch (error) {
      this.log(`Failed to load preferences: ${error.message}`, 'error');
    }
  }

  /**
   * 保存用户偏好
   */
  async savePreferences() {
    try {
      fs.writeFileSync(
        this.preferencesFile,
        JSON.stringify(this.preferences, null, 2),
        'utf8'
      );
    } catch (error) {
      this.log(`Failed to save preferences: ${error.message}`, 'error');
    }
  }

  /**
   * 加载通知历史
   */
  async loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        this.history = JSON.parse(data);
        this.log(`Loaded ${this.history.length} notification records`);
      }
    } catch (error) {
      this.log(`Failed to load history: ${error.message}`, 'error');
    }
  }

  /**
   * 保存通知历史
   */
  async saveHistory() {
    try {
      // 限制历史记录大小
      if (this.history.length > this.maxHistorySize) {
        this.history = this.history.slice(-this.maxHistorySize);
      }

      fs.writeFileSync(
        this.historyFile,
        JSON.stringify(this.history, null, 2),
        'utf8'
      );
    } catch (error) {
      this.log(`Failed to save history: ${error.message}`, 'error');
    }
  }

  /**
   * 初始化通知渠道
   */
  async initChannels() {
    // 这里可以初始化新的通知渠道
    // 微信企业号、钉钉、飞书、企业微信等
    this.log('Notification channels initialized');
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听通知发送事件
    this.on('notification:send', (data) => {
      this.onNotificationSend(data);
    });

    // 监听用户反馈事件
    this.on('notification:feedback', (data) => {
      this.onUserFeedback(data);
    });
  }

  /**
   * 智能路由 - 选择最佳通知渠道
   */
  async smartRoute(message, options = {}) {
    // 1. 检查免打扰模式
    if (this.shouldSuppressNotification(message, options)) {
      this.log('Notification suppressed by DND mode');
      return { suppressed: true, reason: 'dnd' };
    }

    // 2. AI学习 - 根据历史偏好选择渠道
    const preferredChannels = this.learnPreferredChannels(message, options);

    // 3. 动态优先级调整
    const prioritizedChannels = this.adjustPriority(preferredChannels, options);

    return {
      channels: prioritizedChannels,
      confidence: this.calculateConfidence(prioritizedChannels)
    };
  }

  /**
   * 检查是否应该抑制通知（免打扰模式）
   */
  shouldSuppressNotification(message, options) {
    if (!this.dndMode.enabled) {
      return false;
    }

    // 检查是否是例外类型
    if (options.priority && this.dndMode.exceptions.includes(options.priority)) {
      return false;
    }

    // 检查当前时间是否在免打扰时段
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 检查睡眠时间
    if (this.isInTimeRange(currentTime, this.dndMode.schedule.sleepHours)) {
      return true;
    }

    // 自动检测工作时间
    if (this.dndMode.autoDetect) {
      const isWorkingHours = this.isInTimeRange(currentTime, this.dndMode.schedule.workHours);
      const isWorkRelated = this.isWorkRelatedNotification(message, options);

      // 工作时间只允许工作相关通知
      if (isWorkingHours && !isWorkRelated) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查时间是否在范围内
   */
  isInTimeRange(currentTime, range) {
    const { start, end } = range;

    if (start < end) {
      return currentTime >= start && currentTime < end;
    } else {
      // 跨越午夜的情况
      return currentTime >= start || currentTime < end;
    }
  }

  /**
   * 判断是否是工作相关通知
   */
  isWorkRelatedNotification(message, options) {
    const workKeywords = ['error', 'critical', 'build', 'deploy', 'test', 'commit'];
    const messageText = message.toLowerCase();

    return workKeywords.some(keyword => messageText.includes(keyword));
  }

  /**
   * AI学习 - 根据历史偏好选择渠道
   */
  learnPreferredChannels(message, options) {
    if (!this.aiLearning.enabled || this.history.length < this.aiLearning.minSamples) {
      // 样本不足，使用默认规则
      return this.getDefaultChannels(options);
    }

    // 分析历史数据，学习用户偏好
    const analysis = this.analyzeHistory(message, options);

    // 根据分析结果选择渠道
    return this.selectChannelsByAnalysis(analysis);
  }

  /**
   * 分析历史数据
   */
  analyzeHistory(message, options) {
    const relevantHistory = this.history.filter(record => {
      // 筛选相似的通知记录
      return this.calculateSimilarity(record.message, message) > 0.5;
    });

    if (relevantHistory.length === 0) {
      return null;
    }

    // 统计各渠道的使用频率和用户反馈
    const channelStats = {};

    relevantHistory.forEach(record => {
      record.channels.forEach(channel => {
        if (!channelStats[channel]) {
          channelStats[channel] = {
            count: 0,
            positiveCount: 0,
            negativeCount: 0
          };
        }

        channelStats[channel].count++;

        if (record.feedback === 'positive') {
          channelStats[channel].positiveCount++;
        } else if (record.feedback === 'negative') {
          channelStats[channel].negativeCount++;
        }
      });
    });

    return channelStats;
  }

  /**
   * 根据分析结果选择渠道
   */
  selectChannelsByAnalysis(analysis) {
    if (!analysis) {
      return this.getDefaultChannels();
    }

    // 计算每个渠道的得分
    const scores = Object.entries(analysis).map(([channel, stats]) => {
      const positiveRate = stats.positiveCount / stats.count;
      const negativeRate = stats.negativeCount / stats.count;
      const score = positiveRate - negativeRate;

      return { channel, score };
    });

    // 按得分排序
    scores.sort((a, b) => b.score - a.score);

    // 返回得分最高的渠道
    return scores.map(s => s.channel);
  }

  /**
   * 获取默认渠道
   */
  getDefaultChannels(options = {}) {
    if (options.channels) {
      return options.channels;
    }

    // 返回所有可用渠道
    return ['telegram', 'discord', 'slack', 'email'];
  }

  /**
   * 动态优先级调整
   */
  adjustPriority(channels, options) {
    // 根据当前时间、系统负载等因素调整优先级
    const now = new Date();
    const hour = now.getHours();

    // 夜间优先使用静默渠道
    if (hour >= 22 || hour < 7) {
      return channels.sort((a, b) => {
        const silentChannels = ['email'];
        const aIsSilent = silentChannels.includes(a);
        const bIsSilent = silentChannels.includes(b);

        if (aIsSilent && !bIsSilent) return -1;
        if (!aIsSilent && bIsSilent) return 1;
        return 0;
      });
    }

    return channels;
  }

  /**
   * 计算置信度
   */
  calculateConfidence(channels) {
    // 简单的置信度计算
    if (channels.length === 0) return 0;
    if (channels.length === 1) return 0.9;
    return 0.7;
  }

  /**
   * 计算消息相似度
   */
  calculateSimilarity(message1, message2) {
    // 简单的相似度计算（可以使用更复杂的算法）
    const words1 = message1.toLowerCase().split(/\s+/);
    const words2 = message2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = (2 * commonWords.length) / (words1.length + words2.length);

    return similarity;
  }

  /**
   * 通知聚合
   */
  async aggregateNotifications(message, options) {
    if (!this.aggregation.enabled) {
      return null;
    }

    // 添加到待聚合队列
    this.pendingNotifications.push({
      message,
      options,
      timestamp: Date.now()
    });

    // 检查是否需要立即发送
    if (this.pendingNotifications.length >= this.aggregation.maxSize) {
      return await this.flushAggregatedNotifications();
    }

    // 设置聚合定时器
    if (!this.aggregationTimer) {
      this.aggregationTimer = setTimeout(async () => {
        await this.flushAggregatedNotifications();
      }, this.aggregation.window);
    }

    return { aggregated: true };
  }

  /**
   * 发送聚合的通知
   */
  async flushAggregatedNotifications() {
    if (this.pendingNotifications.length === 0) {
      return;
    }

    // 清除定时器
    if (this.aggregationTimer) {
      clearTimeout(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    // 分组相似的通知
    const groups = this.groupSimilarNotifications(this.pendingNotifications);

    // 为每组生成摘要通知
    for (const group of groups) {
      const summary = this.generateSummary(group);
      await this.sendNotification(summary.message, summary.options);
    }

    // 清空队列
    this.pendingNotifications = [];
  }

  /**
   * 分组相似的通知
   */
  groupSimilarNotifications(notifications) {
    const groups = [];

    notifications.forEach(notification => {
      let added = false;

      for (const group of groups) {
        const similarity = this.calculateSimilarity(
          notification.message,
          group[0].message
        );

        if (similarity >= this.aggregation.similarityThreshold) {
          group.push(notification);
          added = true;
          break;
        }
      }

      if (!added) {
        groups.push([notification]);
      }
    });

    return groups;
  }

  /**
   * 生成摘要通知
   */
  generateSummary(group) {
    if (group.length === 1) {
      return group[0];
    }

    const count = group.length;
    const firstMessage = group[0].message;
    const summary = `📦 聚合通知 (${count}条)\n\n${firstMessage}\n\n... 以及 ${count - 1} 条类似通知`;

    return {
      message: summary,
      options: {
        ...group[0].options,
        aggregated: true,
        count
      }
    };
  }

  /**
   * 发送通知（内部方法）
   */
  async sendNotification(message, options) {
    // 调用核心的通知方法
    return await this.notify(message, options);
  }

  /**
   * 处理通知发送事件
   */
  onNotificationSend(data) {
    // 记录到历史
    this.history.push({
      timestamp: Date.now(),
      message: data.message,
      channels: data.channels || [],
      options: data.options || {},
      feedback: null
    });

    this.saveHistory();
  }

  /**
   * 处理用户反馈
   */
  onUserFeedback(data) {
    // 更新历史记录中的反馈
    const record = this.history.find(r => r.timestamp === data.timestamp);

    if (record) {
      record.feedback = data.feedback;
      this.saveHistory();

      // 触发AI学习
      this.updatePreferences(record);
    }
  }

  /**
   * 更新用户偏好
   */
  updatePreferences(record) {
    if (!this.aiLearning.enabled) {
      return;
    }

    // 根据反馈更新偏好
    const { channels, feedback } = record;

    channels.forEach(channel => {
      if (!this.preferences.channelPreferences[channel]) {
        this.preferences.channelPreferences[channel] = {
          score: 0.5,
          count: 0
        };
      }

      const pref = this.preferences.channelPreferences[channel];
      const delta = feedback === 'positive' ? this.aiLearning.learningRate : -this.aiLearning.learningRate;

      pref.score = Math.max(0, Math.min(1, pref.score + delta));
      pref.count++;
    });

    this.savePreferences();
  }

  /**
   * 执行模块任务
   */
  async execute() {
    try {
      // 定期清理过期的历史记录
      this.cleanupHistory();

      // 检查是否有待发送的聚合通知
      if (this.pendingNotifications.length > 0) {
        const oldestNotification = this.pendingNotifications[0];
        const age = Date.now() - oldestNotification.timestamp;

        // 如果最老的通知超过聚合窗口，立即发送
        if (age >= this.aggregation.window) {
          await this.flushAggregatedNotifications();
        }
      }

      this.log('Periodic check completed');
    } catch (error) {
      this.log(`Failed to execute: ${error.message}`, 'error');
    }
  }

  /**
   * 清理过期的历史记录
   */
  cleanupHistory() {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
    const cutoff = Date.now() - maxAge;

    const originalLength = this.history.length;
    this.history = this.history.filter(record => record.timestamp > cutoff);

    if (this.history.length < originalLength) {
      this.log(`Cleaned up ${originalLength - this.history.length} old records`);
      this.saveHistory();
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      historySize: this.history.length,
      pendingNotifications: this.pendingNotifications.length,
      preferences: this.preferences,
      dndMode: {
        enabled: this.dndMode.enabled,
        schedule: this.dndMode.schedule
      },
      aggregation: {
        enabled: this.aggregation.enabled,
        window: this.aggregation.window
      }
    };
  }
}

module.exports = NotificationIntelligence;
