# Heartbeat V2 - 模块化心跳监控系统

## 📋 简介

Heartbeat V2 是一个模块化的 Claude Code 心跳监控系统,用于实时监控 Claude Code 的运行状态,并通过 Telegram 发送通知。

## ✨ 功能特性

### 核心功能
- **模块化架构**: 可插拔的模块系统,易于扩展
- **事件驱动**: 模块间通过事件系统通信
- **统一通知**: 所有模块共享 Telegram 通知接口
- **日志系统**: 完整的日志记录和管理

### 功能模块

1. **Activity Monitor (活动监控)**
   - 监控文件变化和会话活动
   - 检测长时间无活动
   - 发送定期心跳消息

2. **Error Alert (错误告警)**
   - 监控日志文件中的错误
   - 实时告警错误信息
   - 防止告警风暴(限流机制)

3. **Session Tracker (会话追踪)**
   - 追踪所有 Claude Code 会话
   - 统计会话使用情况
   - 生成会话报告

4. **Remote Control (远程控制)**
   - 通过 Telegram 远程控制
   - 支持多种命令
   - 实时响应

5. **Work Stats (工作统计)**
   - 统计工作时长
   - 生成每日报告
   - 追踪使用指标

## 📦 安装

### 前置要求
- Node.js 14+
- Telegram Bot Token (fangyu_news_bot)
- Telegram Chat ID (6145538033)

### 配置文件

配置文件位置: `C:\Users\666\.claude\hooks\scripts\heartbeat-v2\config.json`

已配置的 Telegram Bot:
- Bot Token: 8202383025:AAEzOrCYyJugqOmkd6aObvw1P-7S-YvcJM8
- Chat ID: 6145538033

## 🚀 使用方法

### 启动守护进程

```powershell
# 使用 PowerShell 脚本启动 (推荐)
pwsh C:\Users\666\.claude\hooks\scripts\start-heartbeat-v2.ps1

# 或直接使用 Node.js
cd C:\Users\666\.claude\hooks\scripts\heartbeat-v2
node index.js
```

### 单次执行

```bash
node index.js --once
```

### 使用自定义配置

```bash
node index.js --config /path/to/config.json
```

## 🔧 配置说明

### Telegram 配置

```json
{
  "telegram": {
    "botToken": "8202383025:AAEzOrCYyJugqOmkd6aObvw1P-7S-YvcJM8",
    "chatId": "6145538033",
    "parseMode": "HTML"
  }
}
```

### 日志配置

```json
{
  "logging": {
    "enabled": true,
    "logFile": "~/.claude/logs/heartbeat-v2.log",
    "level": "info"
  }
}
```

### 模块配置

每个模块都有以下通用配置:

- `enabled`: 是否启用模块
- `interval`: 执行间隔 (毫秒)
- `description`: 模块描述

#### Activity Monitor 配置

```json
{
  "activity-monitor": {
    "enabled": true,
    "interval": 1800000,
    "idleThreshold": 300000,
    "notifyOnIdle": true,
    "notifyOnActive": true
  }
}
```

#### Error Alert 配置

```json
{
  "error-alert": {
    "enabled": true,
    "watchFiles": [
      "~/.claude/logs/claude-code.log",
      "~/.claude/logs/heartbeat-v2.log"
    ],
    "errorPatterns": ["ERROR", "FATAL", "Exception"],
    "checkInterval": 60000,
    "maxAlertsPerHour": 10
  }
}
```

## 📱 远程控制命令

通过 Telegram 发送以下命令:

- `/status` - 显示系统状态
- `/stats` - 显示工作统计
- `/modules` - 显示模块状态
- `/restart` - 重启心跳系统
- `/help` - 显示帮助信息

## 🧪 测试

### 快速测试

```bash
cd C:\Users\666\.claude\hooks\scripts\heartbeat-v2
node test-quick.js
```

### 完整集成测试

```bash
node test-integration.js
```

## 📊 日志文件

- 主日志: `C:\Users\666\.claude\logs\heartbeat-v2.log`
- 启动日志: `C:\Users\666\.claude\logs\heartbeat-v2-start.log`

## 🔍 故障排查

### 问题: 模块未启动

**解决方案**:
1. 检查配置文件中模块是否启用
2. 查看日志文件中的错误信息
3. 确认 Node.js 版本 >= 14

### 问题: Telegram 通知失败

**解决方案**:
1. 检查 Bot Token 是否正确
2. 检查 Chat ID 是否正确
3. 确认已在 Telegram 中启动 Bot (发送 /start)
4. 检查网络连接

### 问题: 错误告警过多

**解决方案**:
1. 调整 `error-alert` 模块的 `maxAlertsPerHour` 配置
2. 修改 `errorPatterns` 过滤不需要的错误
3. 增加 `checkInterval` 减少检查频率

## 📝 开发指南

### 创建新模块

1. 在 `modules/` 目录创建新文件
2. 继承 `HeartbeatModule` 基类
3. 实现 `execute()` 方法
4. 在 `config.json` 中添加模块配置

示例:

```javascript
const HeartbeatModule = require('../module-interface');

class MyModule extends HeartbeatModule {
  async execute() {
    // 你的逻辑
    this.log('Module executed');
    await this.notify('通知消息');
  }
}

module.exports = MyModule;
```

## 🔄 与旧版本的区别

### Heartbeat V1 (heartbeat.js)
- 单文件架构
- 功能固定
- 难以扩展

### Heartbeat V2 (heartbeat-v2/)
- 模块化架构
- 可插拔模块
- 易于扩展
- 事件驱动
- 更强大的功能

## 📄 文件结构

```
heartbeat-v2/
├── index.js                 # 主入口
├── heartbeat-core.js        # 核心框架
├── module-interface.js      # 模块接口
├── config.json              # 配置文件
├── modules/                 # 功能模块
│   ├── activity-monitor.js
│   ├── error-alert.js
│   ├── session-tracker.js
│   ├── remote-control.js
│   └── work-stats.js
├── docs/                    # 文档
│   ├── README.md
│   ├── CONFIG.md
│   └── TROUBLESHOOTING.md
└── test-*.js                # 测试脚本
```

## 📞 联系方式

- Telegram: @fangyu_news_bot
- Chat ID: 6145538033
