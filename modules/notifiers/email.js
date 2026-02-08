/**
 * Email Notifier - 邮件通知器
 *
 * 功能：
 * 1. 通过 SMTP 发送邮件
 * 2. 支持 HTML 邮件
 * 3. 支持附件
 */

const https = require('https');
const http = require('http');

class EmailNotifier {
  constructor(config) {
    this.config = config;
    this.name = 'email';
    this.enabled = config.enabled !== false;
    this.smtp = config.smtp || {};
    this.from = config.from;
    this.to = config.to;
    this.subject = config.subject || 'Claude Pulse Notification';
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      throw new Error('Email notifier is disabled');
    }

    if (!this.smtp.host || !this.smtp.port) {
      throw new Error('SMTP host and port are required');
    }

    if (!this.from || !this.to) {
      throw new Error('Email from and to addresses are required');
    }

    // 构建邮件内容
    const emailData = {
      from: options.from || this.from,
      to: options.to || this.to,
      subject: options.subject || this.subject,
      text: options.html ? undefined : message,
      html: options.html ? this.wrapHtml(message) : undefined
    };

    // 如果配置了第三方邮件服务（如 SendGrid, Mailgun），使用 API 方式
    if (this.smtp.apiKey && this.smtp.apiUrl) {
      return this.sendViaAPI(emailData, options);
    }

    // 否则使用 SMTP 方式（需要额外的 SMTP 库，这里提供接口）
    throw new Error('Direct SMTP sending requires nodemailer library. Please use API-based email service or install nodemailer.');
  }

  /**
   * 通过 API 发送邮件（适用于 SendGrid, Mailgun 等服务）
   */
  async sendViaAPI(emailData, options = {}) {
    // 这里以 SendGrid 为例
    if (this.smtp.provider === 'sendgrid') {
      return this.sendViaSendGrid(emailData);
    }

    // 这里以 Mailgun 为例
    if (this.smtp.provider === 'mailgun') {
      return this.sendViaMailgun(emailData);
    }

    throw new Error('Unsupported email provider. Supported: sendgrid, mailgun');
  }

  /**
   * 通过 SendGrid 发送邮件
   */
  async sendViaSendGrid(emailData) {
    const payload = {
      personalizations: [{
        to: [{ email: emailData.to }]
      }],
      from: { email: emailData.from },
      subject: emailData.subject,
      content: [{
        type: emailData.html ? 'text/html' : 'text/plain',
        value: emailData.html || emailData.text
      }]
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);

      const requestOptions = {
        hostname: 'api.sendgrid.com',
        port: 443,
        path: '/v3/mail/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.smtp.apiKey}`,
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(requestOptions, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 202) {
            resolve({ success: true });
          } else {
            reject(new Error(`SendGrid API error: HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`SendGrid request failed: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 通过 Mailgun 发送邮件
   */
  async sendViaMailgun(emailData) {
    const FormData = require('form-data');
    const form = new FormData();

    form.append('from', emailData.from);
    form.append('to', emailData.to);
    form.append('subject', emailData.subject);

    if (emailData.html) {
      form.append('html', emailData.html);
    } else {
      form.append('text', emailData.text);
    }

    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'api.mailgun.net',
        port: 443,
        path: `/v3/${this.smtp.domain}/messages`,
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Authorization': `Basic ${Buffer.from(`api:${this.smtp.apiKey}`).toString('base64')}`
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
            reject(new Error(`Mailgun API error: HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Mailgun request failed: ${error.message}`));
      });

      form.pipe(req);
    });
  }

  /**
   * 包装 HTML 内容
   */
  wrapHtml(content) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 10px;
      text-align: center;
    }
    .content {
      padding: 20px;
      background-color: #f9f9f9;
      border: 1px solid #ddd;
    }
    .footer {
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Claude Pulse Notification</h2>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>Sent by Claude Pulse at ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * 测试连接
   */
  async test() {
    try {
      await this.send('🔔 Email 通知器测试消息', { html: true });
      return { success: true, message: 'Email notifier is working' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = EmailNotifier;