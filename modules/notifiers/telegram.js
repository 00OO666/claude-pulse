/**
 * Telegram Notifier - Telegram 通知器
 *
 * 功能：
 * 1. 通过 Telegram Bot API 发送消息
 * 2. 支持 HTML/Markdown 格式
 * 3. 支持消息长度限制和自动截断
 */

const https = require('https');

class TelegramNotifier {
  constructor(config) {
    this.config = config;
    this.name = 'telegram';
    this.enabled = config.enabled !== false;
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.parseMode = config.parseMode || 'HTML';
    this.maxLength = 4096; // Telegram 消息长度限制
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      throw new Error('Telegram notifier is disabled');
    }

    if (!this.botToken || !this.chatId) {
      throw new Error('Telegram botToken and chatId are required');
    }

    // 截断过长的消息
    let finalMessage = message;
    if (message.length > this.maxLength) {
      finalMessage = message.substring(0, this.maxLength - 50) + '\n\n... (消息已截断)';
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        chat_id: options.chatId || this.chatId,
        text: finalMessage,
        parse_mode: options.parseMode || this.parseMode
      });

      const requestOptions = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${this.botToken}/sendMessage`,
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
            resolve(JSON.parse(responseData));
          } else {
            reject(new Error(`Telegram API error: HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Telegram request failed: ${error.message}`));
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
      await this.send('🔔 Telegram 通知器测试消息');
      return { success: true, message: 'Telegram notifier is working' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = TelegramNotifier;
