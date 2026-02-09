/**
 * Feishu Notifier - 飞书通知器
 *
 * 功能：
 * 1. 通过飞书机器人发送消息
 * 2. 支持文本、富文本、卡片等格式
 * 3. 支持@提醒
 * 4. 支持加签安全设置
 */

const https = require('https');
const crypto = require('crypto');

class FeishuNotifier {
  constructor(config) {
    this.config = config;
    this.name = 'feishu';
    this.enabled = config.enabled !== false;
    this.webhookUrl = config.webhookUrl;
    this.secret = config.secret; // 加签密钥
  }

  /**
   * 生成签名
   */
  generateSign() {
    if (!this.secret) {
      return null;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `${timestamp}\n${this.secret}`;
    const sign = crypto
      .createHmac('sha256', stringToSign)
      .update('')
      .digest('base64');

    return {
      timestamp: timestamp.toString(),
      sign
    };
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      throw new Error('Feishu notifier is disabled');
    }

    if (!this.webhookUrl) {
      throw new Error('Feishu webhookUrl is required');
    }

    const msgType = options.msgType || 'text';
    let payload = {
      msg_type: msgType
    };

    // 添加签名
    const signData = this.generateSign();
    if (signData) {
      payload.timestamp = signData.timestamp;
      payload.sign = signData.sign;
    }

    // 根据消息类型构建内容
    if (msgType === 'interactive') {
      // 卡片消息
      payload.card = options.card || this.buildDefaultCard(message);
    } else if (msgType === 'post') {
      // 富文本消息
      payload.content = {
        post: {
          zh_cn: {
            title: options.title || 'Claude Pulse 通知',
            content: [[{ tag: 'text', text: message }]]
          }
        }
      };
    } else {
      // 文本消息
      payload.content = {
        text: message
      };
    }

    return this.sendRequest(payload);
  }

  /**
   * 构建默认卡片
   */
  buildDefaultCard(message) {
    return {
      header: {
        title: {
          tag: 'plain_text',
          content: 'Claude Pulse 通知'
        },
        template: 'blue'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'plain_text',
            content: message
          }
        }
      ]
    };
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

          if (result.code === 0 || result.StatusCode === 0) {
            resolve(result);
          } else {
            reject(new Error(`Feishu API error: ${result.msg || result.StatusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Feishu request failed: ${error.message}`));
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
      await this.send('🔔 飞书通知器测试消息');
      return { success: true, message: 'Feishu notifier is working' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = FeishuNotifier;
