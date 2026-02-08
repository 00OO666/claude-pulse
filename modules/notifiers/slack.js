/**
 * Slack Notifier - Slack 通知器
 *
 * 功能：
 * 1. 通过 Slack Bot API 或 Webhook 发送消息
 * 2. 支持频道消息和私信
 * 3. 支持 Block Kit 格式
 */

const https = require('https');
const { URL } = require('url');

class SlackNotifier {
  constructor(config) {
    this.config = config;
    this.name = 'slack';
    this.enabled = config.enabled !== false;
    this.webhookUrl = config.webhookUrl;
    this.botToken = config.botToken;
    this.channel = config.channel;
    this.username = config.username || 'Claude Pulse';
    this.iconEmoji = config.iconEmoji || ':robot_face:';
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      throw new Error('Slack notifier is disabled');
    }

    // 如果配置了 webhook，使用 webhook 方式
    if (this.webhookUrl) {
      return this.sendViaWebhook(message, options);
    }

    // 如果配置了 bot token，使用 API 方式
    if (this.botToken) {
      return this.sendViaAPI(message, options);
    }

    throw new Error('Slack webhookUrl or botToken is required');
  }

  /**
   * 通过 Webhook 发送消息
   */
  async sendViaWebhook(message, options = {}) {
    const url = new URL(this.webhookUrl);

    const payload = {
      text: message,
      username: options.username || this.username,
      icon_emoji: options.iconEmoji || this.iconEmoji
    };

    // 如果指定了频道
    if (options.channel || this.channel) {
      payload.channel = options.channel || this.channel;
    }

    // 如果提供了 blocks，使用 Block Kit 格式
    if (options.blocks) {
      payload.blocks = options.blocks;
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);

      const requestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(requestOptions, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ success: true });
          } else {
            reject(new Error(`Slack Webhook error: HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Slack request failed: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 通过 API 发送消息
   */
  async sendViaAPI(message, options = {}) {
    const payload = {
      channel: options.channel || this.channel,
      text: message,
      username: options.username || this.username,
      icon_emoji: options.iconEmoji || this.iconEmoji
    };

    // 如果提供了 blocks，使用 Block Kit 格式
    if (options.blocks) {
      payload.blocks = options.blocks;
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);

      const requestOptions = {
        hostname: 'slack.com',
        port: 443,
        path: '/api/chat.postMessage',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(requestOptions, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          const response = JSON.parse(responseData);
          if (response.ok) {
            resolve(response);
          } else {
            reject(new Error(`Slack API error: ${response.error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Slack request failed: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 测试连接
   */
  async test() {
    try {
      await this.send('🔔 Slack 通知器测试消息');
      return { success: true, message: 'Slack notifier is working' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = SlackNotifier;
