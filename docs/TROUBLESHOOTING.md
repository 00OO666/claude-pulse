# Heartbeat V2 - 故障排查指南

## 常见问题

### 1. 模块未启动

**症状**: 日志显示模块已加载,但未启动

**可能原因**:
- 模块在配置中被禁用
- 模块初始化失败
- 缺少必要的依赖

**解决方案**:

```bash
# 1. 检查配置文件
cat C:\Users\666\.claude\hooks\scripts\heartbeat-v2\config.json

# 2. 查看日志
tail -f C:\Users\666\.claude\logs\heartbeat-v2.log

# 3. 运行快速测试
cd C:\Users\666\.claude\hooks\scripts\heartbeat-v2
node test-quick.js
```

### 2. Telegram 通知失败

**症状**: 日志显示 "Failed to send notification"

**可能原因**:
- Bot Token 错误
- Chat ID 错误
- 未在 Telegram 中启动 Bot
- 网络连接问题

**解决方案**:

```bash
# 1. 测试 Bot Token
curl "https://api.telegram.org/bot8202383025:AAEzOrCYyJugqOmkd6aObvw1P-7S-YvcJM8/getMe"

# 2. 测试发送消息
curl -X POST "https://api.telegram.org/bot8202383025:AAEzOrCYyJugqOmkd6aObvw1P-7S-YvcJM8/sendMessage" \
  -d "chat_id=6145538033" \
  -d "text=Test message"

# 3. 在 Telegram 中启动 Bot
# 打开 @fangyu_news_bot 并发送 /start
```

### 3. 错误告警过多

**症状**: 收到大量错误告警消息

**可能原因**:
- 错误模式匹配过于宽泛
- 检查间隔过短
- 日志文件包含大量错误

**解决方案**:

```json
// 修改 config.json
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

### 4. 内存占用过高

**症状**: Node.js 进程占用大量内存

**可能原因**:
- Session Tracker 加载了大量会话数据
- 文件监控产生大量事件
- 内存泄漏

**解决方案**:

```bash
# 1. 检查内存使用
Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*heartbeat-v2*" } | Select-Object WorkingSet64

# 2. 减少监控范围
# 修改 activity-monitor 配置,减少监控的目录

# 3. 重启进程
pwsh C:\Users\666\.claude\hooks\scripts\start-heartbeat-v2.ps1
```

### 5. 日志文件过大

**症状**: 日志文件占用大量磁盘空间

**解决方案**:

```bash
# 1. 清理旧日志
Remove-Item C:\Users\666\.claude\logs\heartbeat-v2.log.old

# 2. 设置日志轮转
# 创建日志轮转脚本

# 3. 调整日志级别
# 修改 config.json 中的 logging.level 为 "warn"
```

### 6. 远程控制无响应

**症状**: 在 Telegram 中发送命令无响应

**可能原因**:
- Remote Control 模块未启用
- Bot Token 未配置
- 轮询间隔过长

**解决方案**:

```json
// 检查 config.json
{
  "remote-control": {
    "enabled": true,
    "pollInterval": 30000
  }
}
```

### 7. 会话追踪数据不准确

**症状**: 会话统计数据与实际不符

**可能原因**:
- 会话文件损坏
- 数据解析错误
- 缓存未更新

**解决方案**:

```bash
# 1. 清理缓存
Remove-Item C:\Users\666\.claude\hooks\scripts\heartbeat-v2\*.cache

# 2. 重新加载会话数据
# 重启 Heartbeat V2

# 3. 检查会话文件
ls C:\Users\666\.claude\projects\
```

## 诊断工具

### 1. 快速测试

```bash
cd C:\Users\666\.claude\hooks\scripts\heartbeat-v2
node test-quick.js
```

### 2. 完整测试

```bash
node test-integration.js
```

### 3. 查看日志

```bash
# 实时查看日志
tail -f C:\Users\666\.claude\logs\heartbeat-v2.log

# 查看最近的错误
grep "ERROR" C:\Users\666\.claude\logs\heartbeat-v2.log | tail -20

# 查看最近的警告
grep "WARN" C:\Users\666\.claude\logs\heartbeat-v2.log | tail -20
```

### 4. 检查进程

```powershell
# 查看 Heartbeat 进程
Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*heartbeat-v2*" }

# 查看进程详细信息
Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*heartbeat-v2*" } | Format-List *

# 停止进程
Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*heartbeat-v2*" } | Stop-Process
```

### 5. 测试 Telegram 连接

```bash
# 测试 Bot API
curl "https://api.telegram.org/bot8202383025:AAEzOrCYyJugqOmkd6aObvw1P-7S-YvcJM8/getMe"

# 发送测试消息
curl -X POST "https://api.telegram.org/bot8202383025:AAEzOrCYyJugqOmkd6aObvw1P-7S-YvcJM8/sendMessage" \
  -d "chat_id=6145538033" \
  -d "text=Heartbeat V2 测试消息"
```

## 性能优化

### 1. 减少文件监控范围

```javascript
// 修改 activity-monitor.js
// 只监控特定目录
this.projectsDir = path.join(os.homedir(), '.claude', 'projects', 'F--Project-7');
```

### 2. 增加检查间隔

```json
{
  "modules": {
    "activity-monitor": {
      "interval": 3600000
    },
    "error-alert": {
      "checkInterval": 300000
    }
  }
}
```

### 3. 禁用不需要的模块

```json
{
  "modules": {
    "session-tracker": {
      "enabled": false
    },
    "work-stats": {
      "enabled": false
    }
  }
}
```

## 日志分析

### 常见日志消息

| 日志消息 | 含义 | 处理方式 |
|---------|------|---------|
| `Module loaded: xxx` | 模块加载成功 | 正常 |
| `Module started` | 模块启动成功 | 正常 |
| `Failed to send notification` | 通知发送失败 | 检查 Telegram 配置 |
| `Error alert sent` | 错误告警已发送 | 检查错误日志 |
| `Session started` | 新会话开始 | 正常 |
| `File change detected` | 文件变化检测 | 正常 |

### 错误级别

- `INFO`: 信息性消息,正常运行
- `WARN`: 警告消息,可能需要关注
- `ERROR`: 错误消息,需要处理
- `DEBUG`: 调试消息,详细信息

## 紧急恢复

### 完全重置

```bash
# 1. 停止所有进程
Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*heartbeat*" } | Stop-Process -Force

# 2. 清理日志
Remove-Item C:\Users\666\.claude\logs\heartbeat-v2.log

# 3. 重置配置
# 从备份恢复 config.json

# 4. 重新启动
pwsh C:\Users\666\.claude\hooks\scripts\start-heartbeat-v2.ps1
```

### 回滚到旧版本

```bash
# 1. 停止 Heartbeat V2
Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*heartbeat-v2*" } | Stop-Process

# 2. 启动旧版本
node C:\Users\666\.claude\hooks\scripts\heartbeat.js daemon
```

## 联系支持

如果以上方法都无法解决问题,请:

1. 收集日志文件
2. 记录错误消息
3. 描述问题现象
4. 通过 Telegram 联系: @fangyu_news_bot
