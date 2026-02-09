/**
 * DingTalk Notifier - 钉钉通知器
 *
 * 功能：
 * 1. 通过钉钉机器人发送消息
 * 2. 支持文本、Markdown、链接等格式
 * 3. 支持@提醒
 * 4. 支持加签安全设置
 */

const https = require('https');
const crypto = require('crypto');

class DingTalkNotifier {
  constructor(config) {
    this.config = config;
    this.name = 'dingtalk';
    this.enabled = config.enabled !== false;
    this.webhookUrl = config.webhookUrl;
    this.secret = config.secret; // 加签密钥
    this.atMobiles = config.atMobiles || [];
    this.atUserIds = config.atUserIds || [];
    this.isAtAll = config.isAtAll || false;
  }

  /**
   * 生成签名
   */
  generateSign() {
    if (!this.secret) {
      return null;
    }

    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${this.secret}`;
    const sign = crypto
      .createHmac('sha256', this.secret)
      .update(stringToSign)
      .digest('base64');

    return {
      timestamp,
      sign: encodeURIComponent(sign)
    };
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      throw new Error('DingTalk notifier is disabled');
    }

    if (!this.webhookUrl) {
      throw new Error('DingTalk webhookUrl is required');
    }

    const msgType = options.msgType || 'text';
    let payload;

    if (msgType === 'markdown') {
      payload = {
        msgtype: 'markdown',
        markdown: {
          title: options.title || 'Claude Pulse 通知',
          text: message
        },
        at: {
          atMobiles: options.atMobiles || this.atMobiles,
          atUserIds: options.atUserIds || this.atUserIds,
          isAtAll: options.isAtAll || this.isAtAll
        }
      };
    } else {
      payload = {
        msgtype: 'text',
        text: {
          content: message
        },
        at: {
          atMobiles: options.atMobiles || this.atMobiles,
          atUserIds: options.atUserIds || this.atUserIds,
          isAtAll: options.isAtAll || this.isAtAll
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
      let url = this.webhookUrl;

      // 添加签名
      const signData = this.generateSign();
      if (signData) {
        url += `&timestamp=${signData.timestamp}&sign=${signData.sign}`;
      }

      const urlObj = new URL(url);

      const requestOptions = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
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
            reject(new Error(`DingTalk API error: ${result.errmsg}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`DingTalk request failed: ${error.message}`));
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
      await this.send('🔔 钉钉通知器测试消息');
      return { success: true, message: 'DingTalk notifier is working' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = DingTalkNotifier;
