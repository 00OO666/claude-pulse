# Heartbeat V2 - 配置说明

## 配置文件位置

`C:\Users\666\.claude\hooks\scripts\heartbeat-v2\config.json`

## 完整配置示例

```json
{
  "telegram": {
    "botToken": "8202383025:AAEzOrCYyJugqOmkd6aObvw1P-7S-YvcJM8",
    "chatId": "6145538033",
    "parseMode": "HTML"
  },
  "logging": {
    "enabled": true,
    "logFile": "~/.claude/logs/heartbeat-v2.log",
    "level": "info"
  },
  "modules": {
    "activity-monitor": {
      "enabled": true,
      "interval": 1800000,
      "idleThreshold": 300000,
      "notifyOnIdle": true,
      "notifyOnActive": true,
      "description": "监控Claude Code活动状态"
    },
    "error-alert": {
      "enabled": true,
      "watchFiles": [
        "~/.claude/logs/claude-code.log",
        "~/.claude/logs/heartbeat-v2.log"
      ],
      "errorPatterns": [
        "ERROR",
        "FATAL",
        "Exception",
        "failed",
        "timeout"
      ],
      "checkInterval": 60000,
      "maxAlertsPerHour": 10,
      "description": "监控错误日志并告警"
    },
    "session-tracker": {
      "enabled": true,
      "notifyOnStart": true,
      "notifyOnEnd": true,
      "summaryInterval": 3600000,
      "description": "追踪会话信息和使用情况"
    },
    "remote-control": {
      "enabled": true,
      "pollInterval": 30000,
      "commands": {
        "/status": "显示系统状态",
        "/stats": "显示工作统计",
        "/modules": "显示模块状态",
        "/restart": "重启心跳系统",
        "/help": "显示帮助信息"
      },
      "description": "远程控制接口"
    },
    "work-stats": {
      "enabled": true,
      "reportInterval": 3600000,
      "dailyReportTime": "18:00",
      "trackMetrics": {
        "sessions": true,
        "activeTime": true,
        "idleTime": true,
        "errors": true
      },
      "description": "工作统计和报告"
    }
  }
}
```

## 配置项详解

### Telegram 配置

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `botToken` | string | Telegram Bot Token | 必填 |
| `chatId` | string | Telegram Chat ID | 必填 |
| `parseMode` | string | 消息格式 (HTML/Markdown) | HTML |

### 日志配置

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `enabled` | boolean | 是否启用日志 | true |
| `logFile` | string | 日志文件路径 (支持 ~) | 必填 |
| `level` | string | 日志级别 (info/warn/error/debug) | info |

### Activity Monitor 配置

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `enabled` | boolean | 是否启用模块 | true |
| `interval` | number | 心跳间隔 (毫秒) | 1800000 (30分钟) |
| `idleThreshold` | number | 无活动阈值 (毫秒) | 300000 (5分钟) |
| `notifyOnIdle` | boolean | 无活动时通知 | true |
| `notifyOnActive` | boolean | 活动时通知 | true |

### Error Alert 配置

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `enabled` | boolean | 是否启用模块 | true |
| `watchFiles` | array | 监控的日志文件列表 | [] |
| `errorPatterns` | array | 错误关键词列表 | [] |
| `checkInterval` | number | 检查间隔 (毫秒) | 60000 (1分钟) |
| `maxAlertsPerHour` | number | 每小时最大告警数 | 10 |

### Session Tracker 配置

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `enabled` | boolean | 是否启用模块 | true |
| `notifyOnStart` | boolean | 会话开始时通知 | true |
| `notifyOnEnd` | boolean | 会话结束时通知 | true |
| `summaryInterval` | number | 摘要间隔 (毫秒) | 3600000 (1小时) |

### Remote Control 配置

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `enabled` | boolean | 是否启用模块 | true |
| `pollInterval` | number | 轮询间隔 (毫秒) | 30000 (30秒) |
| `commands` | object | 支持的命令列表 | {} |

### Work Stats 配置

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `enabled` | boolean | 是否启用模块 | true |
| `reportInterval` | number | 报告间隔 (毫秒) | 3600000 (1小时) |
| `dailyReportTime` | string | 每日报告时间 (HH:MM) | "18:00" |
| `trackMetrics` | object | 追踪的指标 | {} |

## 配置最佳实践

### 1. 调整心跳间隔

根据需求调整 `activity-monitor.interval`:

- **频繁监控**: 600000 (10分钟)
- **正常监控**: 1800000 (30分钟) - 推荐
- **低频监控**: 3600000 (60分钟)

### 2. 错误告警优化

避免告警风暴:

```json
{
  "error-alert": {
    "checkInterval": 300000,
    "maxAlertsPerHour": 5,
    "errorPatterns": [
      "FATAL",
      "CRITICAL"
    ]
  }
}
```

### 3. 禁用不需要的模块

```json
{
  "modules": {
    "remote-control": {
      "enabled": false
    }
  }
}
```

### 4. 自定义日志路径

```json
{
  "logging": {
    "logFile": "E:/Logs/heartbeat-v2.log"
  }
}
```

## 环境变量

支持通过环境变量覆盖配置:

- `HEARTBEAT_BOT_TOKEN`: Telegram Bot Token
- `HEARTBEAT_CHAT_ID`: Telegram Chat ID
- `HEARTBEAT_LOG_FILE`: 日志文件路径

## 配置验证

启动时会自动验证配置:

- Telegram 配置是否完整
- 日志目录是否可写
- 模块配置是否有效

## 配置热重载

目前不支持热重载,修改配置后需要重启:

```powershell
# 停止现有进程
Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*heartbeat-v2*" } | Stop-Process

# 重新启动
pwsh C:\Users\666\.claude\hooks\scripts\start-heartbeat-v2.ps1
```
