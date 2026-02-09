/**
 * WeChat Work Notifier - 企业微信通知器
 *
 * 功能：
 * 1. 通过企业微信机器人发送消息
 * 2. 支持文本、Markdown格式
 * 3. 支持@提醒
 */

const https = require('https');

class WeChatWorkNotifier {
  constructor(config) {
    this.config = config;
    this.name = 'wechat-work';
    this.enabled = config.enabled !== false;
    this.webhookUrl = config.webhookUrl;
    this.mentionList = config.mentionList || [];
    this.mentionMobile = config.mentionMobile || [];
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      throw new Error('WeChat Work notifier is disabled');
    }

    if (!this.webhookUrl) {
      throw new Error('WeChat Work webhookUrl is required');
    }

    const msgType = options.msgType || 'text';
    let payload;

    if (msgType === 'markdown') {
      payload = {
        msgtype: 'markdown',
        markdown: {
          content: message
        }
      };
    } else {
      payload = {
        msgtype: 'text',
        text: {
          content: message,
          mentioned_list: options.mentionList || this.mentionList,
          mentioned_mobile_list: options.mentionMobile || this.mentionMobile
        }
      };
    }

    return this.sendRequest(payload);
  }

  /**
   * 发送请求
   */
  async sendRequest(payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const url = new URL(this.webhookUrl);

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
          const result = JSON.parse(responseData);

          if (result.errcode === 0) {
            resolve(result);
          } else {
            reject(new Error(`WeChat Work API error: ${result.errmsg}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`WeChat Work request failed: ${error.message}`));
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
      await this.send('🔔 企业微信通知器测试消息');
      return { success: true, message: 'WeChat Work notifier is working' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = WeChatWorkNotifier;
