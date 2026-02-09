# 通知和统计增强功能

## 概述

本次更新为 Claude Pulse 添加了强大的智能通知和深度工作分析功能，包括：

1. **智能通知系统** - AI学习用户偏好，自动优化通知路由
2. **免打扰模式** - 智能识别工作/休息时间
3. **通知聚合** - 自动合并相似通知
4. **更多通知渠道** - 支持企业微信、钉钉、飞书
5. **深度工作分析** - 分析工作效率和专注时间
6. **目标追踪** - 设定和追踪工作目标
7. **成本分析** - 详细的Token消耗分析和预测
8. **成就系统** - 激励用户提高工作效率

---

## 新增模块

### 1. Notification Intelligence (智能通知)

**文件**: `modules/notification-intelligence.js`

**功能**:
- AI学习用户偏好，自动选择最佳通知渠道
- 智能免打扰模式，根据时间和工作状态自动调整
- 通知聚合，减少通知干扰
- 动态优先级调整

**配置示例**:
```json
{
  "notificationIntelligence": {
    "enabled": true,
    "interval": 60000,
    "maxHistorySize": 1000,
    "dndMode": {
      "enabled": true,
      "schedule": {
        "workHours": { "start": "09:00", "end": "18:00" },
        "sleepHours": { "start": "23:00", "end": "07:00" }
      },
      "exceptions": ["critical", "error"],
      "autoDetect": true
    },
    "aggregation": {
      "enabled": true,
      "window": 300000,
      "maxSize": 10,
      "similarityThreshold": 0.7
    },
    "aiLearning": {
      "enabled": true,
      "minSamples": 50,
      "learningRate": 0.1
    }
  }
}
```

**使用方法**:
```javascript
// 智能路由
const result = await notificationIntelligence.smartRoute(message, options);

// 通知聚合
await notificationIntelligence.aggregateNotifications(message, options);

// 获取统计
const stats = notificationIntelligence.getStats();
```

---

### 2. Work Analytics (深度工作分析)

**文件**: `modules/work-analytics.js`

**功能**:
- 深度工作分析 - 追踪专注时间和工作效率
- 目标设定和追踪 - 支持每日/每周/每月目标
- 成本分析 - Token使用统计和成本预测
- 生产力报告 - 自动生成详细报告
- 成就系统 - 解锁成就激励用户

**配置示例**:
```json
{
  "workAnalytics": {
    "enabled": true,
    "interval": 60000,
    "focusThreshold": 300000,
    "tokenCostPerK": {
      "gpt-4": 0.03,
      "gpt-3.5-turbo": 0.002,
      "claude-3-opus": 0.015,
      "claude-3-sonnet": 0.003
    }
  }
}
```

**使用方法**:
```javascript
// 添加目标
const goal = workAnalytics.addGoal('daily', {
  title: '完成10个任务',
  target: 10,
  deadline: Date.now() + 86400000
});

// 更新目标进度
workAnalytics.updateGoalProgress(goal.id, 'daily', 50);

// 生成生产力报告
const report = workAnalytics.generateProductivityReport();

// 获取成本预测
const prediction = workAnalytics.generateCostPrediction();
```

---

## 新增通知渠道

### 1. 企业微信 (WeChat Work)

**文件**: `modules/notifiers/wechat-work.js`

**配置**:
```json
{
  "wechatWork": {
    "enabled": true,
    "webhookUrl": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY",
    "mentionList": ["@all"],
    "mentionMobile": []
  }
}
```

### 2. 钉钉 (DingTalk)

**文件**: `modules/notifiers/dingtalk.js`

**配置**:
```json
{
  "dingtalk": {
    "enabled": true,
    "webhookUrl": "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN",
    "secret": "YOUR_SECRET",
    "atMobiles": [],
    "atUserIds": [],
    "isAtAll": false
  }
}
```

### 3. 飞书 (Feishu)

**文件**: `modules/notifiers/feishu.js`

**配置**:
```json
{
  "feishu": {
    "enabled": true,
    "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_HOOK",
    "secret": "YOUR_SECRET"
  }
}
```

---

## 核心功能详解

### 智能路由

智能路由会根据以下因素自动选择最佳通知渠道：

1. **历史偏好** - AI学习用户过去的选择
2. **时间因素** - 夜间优先使用静默渠道
3. **消息类型** - 不同类型的消息使用不同渠道
4. **用户反馈** - 根据用户反馈调整权重

### 免打扰模式

免打扰模式支持：

1. **时间段设置** - 工作时间、睡眠时间
2. **自动检测** - 根据消息内容判断是否工作相关
3. **例外规则** - 紧急通知可以突破免打扰
4. **智能学习** - 学习用户的工作模式

### 通知聚合

通知聚合功能：

1. **相似度检测** - 自动识别相似通知
2. **时间窗口** - 在指定时间内聚合通知
3. **批量发送** - 减少通知干扰
4. **摘要生成** - 自动生成聚合摘要

### 深度工作分析

深度工作分析提供：

1. **专注时间追踪** - 记录连续工作时间
2. **中断统计** - 统计工作中断次数
3. **生产力得分** - 综合评估工作效率
4. **工作模式分析** - 找出最佳工作时段

### 成本分析

成本分析功能：

1. **Token使用统计** - 按日/周/月统计
2. **按模型分类** - 不同模型的成本对比
3. **成本预测** - 预测未来成本趋势
4. **优化建议** - 提供成本优化建议

### 成就系统

成就系统包括：

1. **初次启动** - 完成第一个工作会话
2. **专注大师** - 连续专注工作2小时
3. **早起的鸟儿** - 早上6点前开始工作
4. **夜猫子** - 晚上11点后工作
5. **高效一周** - 一周内完成50个任务
6. **成本优化师** - 单日Token成本低于$1

---

## 数据存储

所有数据存储在 `~/.claude/` 目录下：

```
~/.claude/
├── notification-intelligence/
│   ├── preferences.json      # 用户偏好
│   └── history.json          # 通知历史
└── work-analytics/
    ├── analytics.json        # 工作分析数据
    ├── goals.json            # 目标数据
    ├── achievements.json     # 成就数据
    └── cost-analysis.json    # 成本分析数据
```

---

## API 接口

### Notification Intelligence

```javascript
// 智能路由
smartRoute(message, options)

// 通知聚合
aggregateNotifications(message, options)

// 发送通知
sendNotification(message, options)

// 获取统计
getStats()
```

### Work Analytics

```javascript
// 添加目标
addGoal(type, goal)

// 更新目标进度
updateGoalProgress(goalId, type, progress)

// 生成生产力报告
generateProductivityReport()

// 生成成本预测
generateCostPrediction()

// 获取统计
getStats()
```

---

## 事件系统

### 触发事件

```javascript
// 通知发送
emit('notification:send', { message, channels, options })

// 用户反馈
emit('notification:feedback', { timestamp, feedback })

// 会话开始/结束
emit('session:start', data)
emit('session:end', data)

// 活动检测
emit('activity:detected', data)
emit('activity:idle', data)

// Token使用
emit('token:usage', { model, inputTokens, outputTokens, cost })

// 目标完成
emit('goal:completed', { goalId, type })
```

---

## 最佳实践

### 1. 配置免打扰模式

根据你的工作习惯配置免打扰时段：

```json
{
  "dndMode": {
    "enabled": true,
    "schedule": {
      "workHours": { "start": "09:00", "end": "18:00" },
      "sleepHours": { "start": "23:00", "end": "07:00" }
    },
    "exceptions": ["critical", "error"]
  }
}
```

### 2. 设置合理的聚合窗口

根据通知频率调整聚合窗口：

```json
{
  "aggregation": {
    "enabled": true,
    "window": 300000,  // 5分钟
    "maxSize": 10
  }
}
```

### 3. 定期查看生产力报告

每天晚上10点会自动发送生产力报告，包括：
- 工作概况
- 目标完成情况
- 成本分析
- 最佳工作时段

### 4. 设定合理的目标

使用SMART原则设定目标：
- Specific (具体的)
- Measurable (可衡量的)
- Achievable (可实现的)
- Relevant (相关的)
- Time-bound (有时限的)

---

## 故障排除

### 问题1: 通知未发送

**检查**:
1. 通知渠道是否启用
2. Webhook URL是否正确
3. 网络连接是否正常

### 问题2: AI学习不生效

**检查**:
1. 历史样本是否足够 (默认需要50条)
2. AI学习是否启用
3. 用户反馈是否记录

### 问题3: 成本统计不准确

**检查**:
1. Token成本配置是否正确
2. Token使用事件是否正确触发
3. 数据文件是否损坏

---

## 更新日志

### v2.0.0 (2024-02-09)

**新增功能**:
- ✅ 智能通知系统
- ✅ 免打扰模式
- ✅ 通知聚合
- ✅ 企业微信、钉钉、飞书通知渠道
- ✅ 深度工作分析
- ✅ 目标追踪系统
- ✅ 成本分析和预测
- ✅ 成就系统

---

## 贡献

欢迎提交 Issue 和 Pull Request！

---

## 许可证

MIT License
