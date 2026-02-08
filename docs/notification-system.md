# 多渠道通知系统

## 概述

多渠道通知系统提供了统一的通知接口，支持多种通知渠道（Telegram、Discord、Slack、Email），并提供智能路由、优先级管理和限流功能。

## 架构

```
NotificationRouter (通知路由)
├── TelegramNotifier (Telegram 通知器)
├── DiscordNotifier (Discord 通知器)
├── SlackNotifier (Slack 通知器)
└── EmailNotifier (Email 通知器)
```

## 支持的通知渠道

### 1. Telegram

- **方式**: Bot API
- **格式**: HTML/Markdown
- **限制**: 4096 字符
- **配置**:
  ```json
  {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID",
      "parseMode": "HTML"
    }
  }
  ```

### 2. Discord

- **方式**: Webhook
- **格式**: 纯文本 / Embed
- **限制**: 2000 字符
- **配置**:
  ```json
  {
    "discord": {
      "enabled": true,
      "webhookUrl": "https://discord.com/api/webhooks/...",
      "username": "Claude Pulse",
      "avatarUrl": null
    }
  }
  ```

### 3. Slack

- **方式**: Webhook / Bot API
- **格式**: 纯文本 / Block Kit
- **配置**:
  ```json
  {
    "slack": {
      "enabled": true,
      "webhookUrl": "https://hooks.slack.com/services/...",
      "channel": "#general",
      "username": "Claude Pulse"
    }
  }
  ```

### 4. Email

- **方式**: SMTP / API (SendGrid, Mailgun)
- **格式**: 纯文本 / HTML
- **配置**:
  ```json
  {
    "email": {
      "enabled": true,
      "from": "noreply@example.com",
      "to": "your-email@example.com",
      "smtp": {
        "provider": "sendgrid",
        "apiKey": "YOUR_API_KEY"
      }
    }
  }
  ```

## 通知规则

通知路由支持基于规则的智能路由，可以根据消息类型、优先级、关键词等条件选择通知渠道。

### 规则配置

```json
{
  "notificationRules": [
    {
      "type": "error",
      "channels": ["telegram", "email"],
      "priority": "high",
      "description": "错误告警发送到 Telegram 和 Email"
    },
    {
      "keywords": ["critical", "urgent"],
      "channels": ["telegram", "discord", "slack", "email"],
      "priority": "critical",
      "description": "包含关键词的消息发送到所有渠道"
    },
    {
      "modules": ["error-alert"],
      "channels": ["telegram"],
      "description": "特定模块的通知"
    }
  ]
}
```

### 规则匹配条件

- **type**: 消息类型（error, warning, info）
- **priority**: 优先级（critical, high, medium, low）
- **keywords**: 关键词列表
- **modules**: 模块名称列表

## 使用方法

### 1. 基本使用

```javascript
const NotificationRouter = require('./modules/notification-router');

// 创建通知路由
const router = new NotificationRouter(config);
await router.init();

// 发送通知
await router.notify('Hello, World!');
```

### 2. 指定通知类型

```javascript
// 发送错误通知
await router.notify('发生错误', {
  type: 'error',
  priority: 'high'
});

// 发送警告通知
await router.notify('警告信息', {
  type: 'warning',
  priority: 'medium'
});
```

### 3. 指定通知渠道

```javascript
// 只发送到 Telegram
await router.notify('消息内容', {
  channels: ['telegram']
});

// 发送到多个渠道
await router.notify('重要消息', {
  channels: ['telegram', 'email']
});
```

### 4. 使用 Discord Embed

```javascript
await router.notify('消息内容', {
  channels: ['discord'],
  embed: {
    title: '通知标题',
    color: 0xff0000, // 红色
    fields: [
      { name: '字段1', value: '值1' },
      { name: '字段2', value: '值2' }
    ]
  }
});
```

### 5. 发送 HTML 邮件

```javascript
await router.notify('<h1>标题</h1><p>内容</p>', {
  channels: ['email'],
  html: true,
  subject: '自定义主题'
});
```

## 限流功能

通知系统支持全局限流和渠道级限流，防止消息发送过于频繁。

### 配置限流

```json
{
  "globalRateLimit": {
    "max": 100,
    "window": 60000
  },
  "telegram": {
    "rateLimit": {
      "max": 30,
      "window": 60000
    }
  }
}
```

- **max**: 时间窗口内最大消息数
- **window**: 时间窗口（毫秒）

### 消息队列

当触发限流时，消息会自动加入队列，等待限流解除后发送。

```javascript
// 获取队列状态
const status = router.getStatus();
console.log(`队列大小: ${status.queueSize}`);

// 手动处理队列
await router.processQueue();
```

## 测试

### 运行测试脚本

```bash
node test-notification.js
```

### 测试单个通知器

```javascript
const results = await router.testAll();
console.log(results);
```

## 集成到 HeartbeatCore

### 修改 heartbeat-core.js

```javascript
const NotificationRouter = require('./modules/notification-router');

class HeartbeatCore extends EventEmitter {
  constructor(configPath) {
    super();
    // ...
    this.notificationRouter = null;
  }

  async init() {
    // ...

    // 初始化通知路由
    this.notificationRouter = new NotificationRouter(this.config);
    await this.notificationRouter.init();
  }

  async notify(message, options = {}) {
    if (this.notificationRouter) {
      return this.notificationRouter.notify(message, options);
    }

    // 降级到原有的 Telegram 通知
    return this.sendTelegramMessage(message, options);
  }
}
```

## 最佳实践

### 1. 错误告警

```javascript
await router.notify('🔴 系统错误', {
  type: 'error',
  priority: 'high',
  module: 'error-alert'
});
```

### 2. 状态更新

```javascript
await router.notify('✅ 任务完成', {
  type: 'info',
  priority: 'low'
});
```

### 3. 紧急通知

```javascript
await router.notify('🚨 CRITICAL: 紧急情况', {
  type: 'error',
  priority: 'critical',
  channels: ['telegram', 'discord', 'slack', 'email']
});
```

## 故障排查

### 1. 通知发送失败

- 检查通知器配置是否正确
- 检查 API Token/Webhook URL 是否有效
- 检查网络连接

### 2. 消息被限流

- 检查限流配置
- 查看队列状态
- 调整限流参数

### 3. 规则不匹配

- 检查规则配置
- 使用 `console.log` 调试规则匹配
- 确认消息选项是否正确

## 扩展

### 添加新的通知渠道

1. 创建新的通知器类（继承基本接口）
2. 在 `NotificationRouter` 中注册
3. 更新配置文件

示例：

```javascript
class CustomNotifier {
  constructor(config) {
    this.config = config;
    this.name = 'custom';
    this.enabled = config.enabled !== false;
  }

  async send(message, options = {}) {
    // 实现发送逻辑
  }

  async test() {
    // 实现测试逻辑
  }
}

module.exports = CustomNotifier;
```

## 参考

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [Slack API](https://api.slack.com/)
- [SendGrid API](https://docs.sendgrid.com/)
- [Mailgun API](https://documentation.mailgun.com/)
