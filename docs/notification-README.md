# 多渠道通知系统

## 快速开始

### 1. 配置通知渠道

复制配置示例：
```bash
cp config.notification.example.json config.notification.json
```

编辑 `config.notification.json`，填入你的凭证：
- Telegram: `botToken`, `chatId`
- Discord: `webhookUrl`
- Slack: `webhookUrl` 或 `botToken`
- Email: `apiKey`, `from`, `to`

### 2. 初始化通知路由

```javascript
const NotificationRouter = require('./modules/notification-router');

const router = new NotificationRouter(config);
await router.init();
```

### 3. 发送通知

```javascript
// 基本用法
await router.notify('Hello, World!');

// 指定类型和优先级
await router.notify('发生错误', {
  type: 'error',
  priority: 'high'
});

// 指定渠道
await router.notify('重要消息', {
  channels: ['telegram', 'email']
});
```

### 4. 测试

```bash
node test-notification.js
```

## 支持的渠道

- ✅ **Telegram** - Bot API
- ✅ **Discord** - Webhook + Embed
- ✅ **Slack** - Webhook/Bot API + Block Kit
- ✅ **Email** - SendGrid/Mailgun

## 核心特性

- 🎯 **智能路由** - 基于规则自动选择渠道
- 🚦 **限流保护** - 防止消息过于频繁
- 📦 **消息队列** - 限流时自动排队
- 🔄 **降级方案** - 失败时自动降级
- 🔌 **易于扩展** - 可轻松添加新渠道

## 文档

- [完整文档](docs/notification-system.md)
- [集成示例](docs/integration-example.js)
- [配置示例](config.notification.example.json)

## 架构

```
NotificationRouter
├── TelegramNotifier
├── DiscordNotifier
├── SlackNotifier
└── EmailNotifier
```

## 通知规则示例

```json
{
  "notificationRules": [
    {
      "type": "error",
      "channels": ["telegram", "email"],
      "priority": "high"
    },
    {
      "keywords": ["critical", "urgent"],
      "channels": ["telegram", "discord", "slack", "email"],
      "priority": "critical"
    }
  ]
}
```

## 使用示例

### 错误告警
```javascript
await router.notify('🔴 系统错误', {
  type: 'error',
  priority: 'high',
  module: 'error-alert'
});
```

### Discord Embed
```javascript
await router.notify('系统状态', {
  channels: ['discord'],
  embed: {
    title: '状态更新',
    color: 0x00ff00,
    fields: [
      { name: 'CPU', value: '45%' },
      { name: '内存', value: '2.5GB' }
    ]
  }
});
```

### HTML 邮件
```javascript
await router.notify('<h1>标题</h1><p>内容</p>', {
  channels: ['email'],
  html: true,
  subject: '自定义主题'
});
```

## 限流配置

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

## 故障排查

### 通知发送失败
1. 检查配置是否正确
2. 检查 API Token/Webhook URL
3. 检查网络连接

### 消息被限流
1. 检查限流配置
2. 查看队列状态：`router.getStatus()`
3. 调整限流参数

### 规则不匹配
1. 检查规则配置
2. 确认消息选项是否正确
3. 使用 `console.log` 调试

## 扩展

添加新的通知渠道：

1. 创建通知器类（参考现有实现）
2. 在 `NotificationRouter` 中注册
3. 更新配置文件

## License

MIT
