/**
 * Notification Router - 通知路由模块
 *
 * 功能：
 * 1. 统一的通知接口
 * 2. 根据规则选择通知渠道
 * 3. 优先级和过滤
 * 4. 批量发送和限流
 */

const TelegramNotifier = require('./notifiers/telegram');
const DiscordNotifier = require('./notifiers/discord');
const SlackNotifier = require('./notifiers/slack');
const EmailNotifier = require('./notifiers/email');

class NotificationRouter {
  constructor(config) {
    this.config = config;
    this.notifiers = new Map();
    this.rules = config.notificationRules || [];
    this.rateLimits = new Map(); // 限流记录
    this.messageQueue = []; // 消息队列
    this.processing = false;
  }

  /**
   * 初始化通知路由
   */
  async init() {
    // 加载所有配置的通知器
    if (this.config.telegram) {
      const telegram = new TelegramNotifier(this.config.telegram);
      this.notifiers.set('telegram', telegram);
    }

    if (this.config.discord) {
      const discord = new DiscordNotifier(this.config.discord);
      this.notifiers.set('discord', discord);
    }

    if (this.config.slack) {
      const slack = new SlackNotifier(this.config.slack);
      this.notifiers.set('slack', slack);
    }

    if (this.config.email) {
      const email = new EmailNotifier(this.config.email);
      this.notifiers.set('email', email);
    }

    console.log(`[NotificationRouter] Initialized with ${this.notifiers.size} notifiers`);
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async notify(message, options = {}) {
    // 确定要使用的通知渠道
    const channels = this.selectChannels(message, options);

    if (channels.length === 0) {
      console.log('[NotificationRouter] No channels selected for notification');
      return { success: false, message: 'No channels available' };
    }

    // 检查限流
    if (this.isRateLimited(channels, options)) {
      console.log('[NotificationRouter] Rate limit exceeded, queuing message');
      this.messageQueue.push({ message, options, channels });
      return { success: false, message: 'Rate limited, message queued' };
    }

    // 发送到所有选定的渠道
    const results = await Promise.allSettled(
      channels.map(channel => this.sendToChannel(channel, message, options))
    );

    // 更新限流记录
    this.updateRateLimits(channels);

    // 处理结果
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      success: successful > 0,
      successful,
      failed,
      total: channels.length,
      results
    };
  }

  /**
   * 选择通知渠道
   */
  selectChannels(message, options = {}) {
    // 如果明确指定了渠道，使用指定的渠道
    if (options.channels && Array.isArray(options.channels)) {
      return options.channels.filter(ch => this.notifiers.has(ch));
    }

    // 根据规则选择渠道
    const matchedChannels = new Set();

    for (const rule of this.rules) {
      if (this.matchRule(rule, message, options)) {
        rule.channels.forEach(ch => {
          if (this.notifiers.has(ch)) {
            matchedChannels.add(ch);
          }
        });
      }
    }

    // 如果没有匹配的规则，使用默认渠道
    if (matchedChannels.size === 0 && this.config.defaultChannels) {
      this.config.defaultChannels.forEach(ch => {
        if (this.notifiers.has(ch)) {
          matchedChannels.add(ch);
        }
      });
    }

    // 如果还是没有，使用第一个可用的通知器
    if (matchedChannels.size === 0 && this.notifiers.size > 0) {
      matchedChannels.add(this.notifiers.keys().next().value);
    }

    return Array.from(matchedChannels);
  }

  /**
   * 匹配规则
   */
  matchRule(rule, message, options) {
    // 检查类型匹配
    if (rule.type && options.type !== rule.type) {
      return false;
    }

    // 检查优先级匹配
    if (rule.priority && options.priority !== rule.priority) {
      return false;
    }

    // 检查关键词匹配
    if (rule.keywords && Array.isArray(rule.keywords)) {
      const hasKeyword = rule.keywords.some(keyword =>
        message.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // 检查模块匹配
    if (rule.modules && Array.isArray(rule.modules)) {
      if (!options.module || !rule.modules.includes(options.module)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 发送到指定渠道
   */
  async sendToChannel(channel, message, options) {
    const notifier = this.notifiers.get(channel);

    if (!notifier) {
      throw new Error(`Notifier ${channel} not found`);
    }

    if (!notifier.enabled) {
      throw new Error(`Notifier ${channel} is disabled`);
    }

    try {
      const result = await notifier.send(message, options);
      console.log(`[NotificationRouter] Sent to ${channel}: success`);
      return result;
    } catch (error) {
      console.error(`[NotificationRouter] Failed to send to ${channel}:`, error.message);
      throw error;
    }
  }

  /**
   * 检查是否被限流
   */
  isRateLimited(channels, options) {
    // 如果配置了全局限流
    if (this.config.globalRateLimit) {
      const limit = this.config.globalRateLimit;
      const key = 'global';
      const record = this.rateLimits.get(key) || { count: 0, resetAt: Date.now() + limit.window };

      if (Date.now() < record.resetAt && record.count >= limit.max) {
        return true;
      }
    }

    // 检查每个渠道的限流
    for (const channel of channels) {
      const notifier = this.notifiers.get(channel);
      if (notifier && notifier.config.rateLimit) {
        const limit = notifier.config.rateLimit;
        const key = `channel:${channel}`;
        const record = this.rateLimits.get(key) || { count: 0, resetAt: Date.now() + limit.window };

        if (Date.now() < record.resetAt && record.count >= limit.max) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 更新限流记录
   */
  updateRateLimits(channels) {
    const now = Date.now();

    // 更新全局限流
    if (this.config.globalRateLimit) {
      const limit = this.config.globalRateLimit;
      const key = 'global';
      const record = this.rateLimits.get(key) || { count: 0, resetAt: now + limit.window };

      if (now >= record.resetAt) {
        record.count = 1;
        record.resetAt = now + limit.window;
      } else {
        record.count++;
      }

      this.rateLimits.set(key, record);
    }

    // 更新每个渠道的限流
    for (const channel of channels) {
      const notifier = this.notifiers.get(channel);
      if (notifier && notifier.config.rateLimit) {
        const limit = notifier.config.rateLimit;
        const key = `channel:${channel}`;
        const record = this.rateLimits.get(key) || { count: 0, resetAt: now + limit.window };

        if (now >= record.resetAt) {
          record.count = 1;
          record.resetAt = now + limit.window;
        } else {
          record.count++;
        }

        this.rateLimits.set(key, record);
      }
    }
  }

  /**
   * 处理消息队列
   */
  async processQueue() {
    if (this.processing || this.messageQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.messageQueue.length > 0) {
      const { message, options, channels } = this.messageQueue[0];

      // 检查是否还在限流中
      if (this.isRateLimited(channels, options)) {
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // 发送消息
      await this.notify(message, { ...options, channels });

      // 移除已处理的消息
      this.messageQueue.shift();
    }

    this.processing = false;
  }

  /**
   * 测试所有通知器
   */
  async testAll() {
    const results = {};

    for (const [name, notifier] of this.notifiers) {
      try {
        const result = await notifier.test();
        results[name] = result;
      } catch (error) {
        results[name] = { success: false, message: error.message };
      }
    }

    return results;
  }

  /**
   * 获取通知器状态
   */
  getStatus() {
    const status = {
      notifiers: {},
      rules: this.rules.length,
      queueSize: this.messageQueue.length,
      rateLimits: {}
    };

    for (const [name, notifier] of this.notifiers) {
      status.notifiers[name] = {
        enabled: notifier.enabled,
        name: notifier.name
      };
    }

    for (const [key, record] of this.rateLimits) {
      status.rateLimits[key] = {
        count: record.count,
        resetAt: new Date(record.resetAt).toISOString()
      };
    }

    return status;
  }
}

module.exports = NotificationRouter;