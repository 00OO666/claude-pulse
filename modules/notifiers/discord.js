/**
 * Discord Notifier - Discord 通知器
 *
 * 功能：
 * 1. 通过 Discord Webhook 发送消息
 * 2. 支持富文本格式（Embed）
 * 3. 支持自定义颜色和字段
 */

const https = require('https');
const { URL } = require('url');

class DiscordNotifier {
  constructor(config) {
    this.config = config;
    this.name = 'discord';
    this.enabled = config.enabled !== false;
    this.webhookUrl = config.webhookUrl;
    this.username = config.username || 'Claude Pulse';
    this.avatarUrl = config.avatarUrl || null;
    this.maxLength = 2000; // Discord 消息长度限制
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      throw new Error('Discord notifier is disabled');
    }

    if (!this.webhookUrl) {
      throw new Error('Discord webhookUrl is required');
    }

    // 解析 webhook URL
    const url = new URL(this.webhookUrl);

    // 构建消息内容
    const payload = {
      username: options.username || this.username,
      avatar_url: options.avatarUrl || this.avatarUrl
    };

    // 如果提供了 embed 选项，使用 embed 格式
    if (options.embed) {
      payload.embeds = [this.buildEmbed(message, options.embed)];
    } else {
      // 截断过长的消息
      payload.content = message.length > this.maxLength
        ? message.substring(0, this.maxLength - 50) + '\n\n... (消息已截断)'
        : message;
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
          if (res.statusCode === 204 || res.statusCode === 200) {
            resolve({ success: true });
          } else {
            reject(new Error(`Discord API error: HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Discord request failed: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 构建 Embed 消息
   */
  buildEmbed(message, embedOptions = {}) {
    const embed = {
      description: message.length > 4096
        ? message.substring(0, 4096 - 50) + '\n\n... (消息已截断)'
        : message,
      timestamp: new Date().toISOString()
    };

    // 添加可选字段
    if (embedOptions.title) embed.title = embedOptions.title;
    if (embedOptions.color) embed.color = embedOptions.color;
    if (embedOptions.fields) embed.fields = embedOptions.fields;
    if (embedOptions.footer) embed.footer = embedOptions.footer;
    if (embedOptions.author) embed.author = embedOptions.author;

    return embed;
  }

  /**
   * 测试连接
   */
  async test() {
    try {
      await this.send('🔔 Discord 通知器测试消息', {
        embed: {
          title: 'Test Notification',
          color: 0x00ff00 // 绿色
        }
      });
      return { success: true, message: 'Discord notifier is working' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = DiscordNotifier;
