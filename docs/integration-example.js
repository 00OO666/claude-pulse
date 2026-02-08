/**
 * HeartbeatCore 集成示例
 *
 * 展示如何将多渠道通知系统集成到 HeartbeatCore
 */

// 在 heartbeat-core.js 顶部添加
const NotificationRouter = require('./modules/notification-router');

// 在 HeartbeatCore 类的构造函数中添加
class HeartbeatCore extends EventEmitter {
  constructor(configPath) {
    super();
    this.configPath = configPath;
    this.config = null;
    this.modules = new Map();
    this.running = false;
    this.notificationRouter = null; // 添加这一行
  }

  // 在 init() 方法中初始化通知路由
  async init() {
    // 加载配置
    this.loadConfig();

    // 初始化日志
    this.initLogger();

    // 初始化通知路由（添加这部分）
    try {
      this.notificationRouter = new NotificationRouter(this.config);
      await this.notificationRouter.init();
      this.log('Notification router initialized', 'info');
    } catch (error) {
      this.log(`Failed to initialize notification router: ${error.message}`, 'warn');
      // 如果通知路由初始化失败，继续使用原有的 Telegram 通知
    }

    // 加载模块
    await this.loadModules();

    this.log('Heartbeat Core initialized', 'info');
  }

  // 修改 notify() 方法以使用通知路由
  async notify(message, options = {}) {
    // 如果通知路由可用，使用通知路由
    if (this.notificationRouter) {
      try {
        return await this.notificationRouter.notify(message, options);
      } catch (error) {
        this.log(`Notification router failed: ${error.message}`, 'error');
        // 降级到原有的 Telegram 通知
      }
    }

    // 降级方案：使用原有的 Telegram 通知
    return this.sendTelegramMessage(message, options);
  }

  // 保留原有的 Telegram 通知方法作为降级方案
  async sendTelegramMessage(message, options = {}) {
    const { botToken, chatId, parseMode } = this.config.telegram;

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: options.parseMode || parseMode
      });

      const requestOptions = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/sendMessage`,
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
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  // 添加获取通知系统状态的方法
  getNotificationStatus() {
    if (this.notificationRouter) {
      return this.notificationRouter.getStatus();
    }
    return { error: 'Notification router not initialized' };
  }

  // 添加测试通知系统的方法
  async testNotifications() {
    if (this.notificationRouter) {
      return await this.notificationRouter.testAll();
    }
    return { error: 'Notification router not initialized' };
  }
}

// 使用示例

// 1. 发送普通通知（使用默认规则）
await core.notify('✅ 系统启动成功');

// 2. 发送错误通知（根据规则自动路由到多个渠道）
await core.notify('🔴 发生错误', {
  type: 'error',
  priority: 'high',
  module: 'error-alert'
});

// 3. 发送到指定渠道
await core.notify('📢 重要通知', {
  channels: ['telegram', 'email']
});

// 4. 使用 Discord Embed 格式
await core.notify('系统状态更新', {
  channels: ['discord'],
  embed: {
    title: '系统状态',
    color: 0x00ff00,
    fields: [
      { name: 'CPU', value: '45%' },
      { name: '内存', value: '2.5GB' }
    ]
  }
});

// 5. 获取通知系统状态
const status = core.getNotificationStatus();
console.log('通知系统状态:', status);

// 6. 测试所有通知器
const testResults = await core.testNotifications();
console.log('测试结果:', testResults);

module.exports = HeartbeatCore;
