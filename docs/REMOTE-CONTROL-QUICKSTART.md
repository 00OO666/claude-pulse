# Remote Control Enhanced - 快速入门指南

## 5分钟快速上手

### 步骤1: 创建Telegram Bot

1. 在Telegram中搜索 `@BotFather`
2. 发送 `/newbot` 创建新Bot
3. 按提示设置Bot名称和用户名
4. 保存Bot Token（类似：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 步骤2: 获取你的Chat ID

1. 在Telegram中搜索 `@userinfobot`
2. 发送任意消息
3. Bot会返回你的Chat ID（纯数字，如：`6145538033`）

### 步骤3: 配置Claude Pulse

编辑 `config.json`：

```json
{
  "modules": {
    "remote-control": {
      "enabled": true,
      "interval": 5000,
      "botToken": "你的Bot Token",
      "allowedChatIds": ["你的Chat ID"],
      "userPermissions": {
        "你的Chat ID": "admin"
      }
    }
  }
}
```

### 步骤4: 启动Claude Pulse

```bash
cd C:/Users/666/.claude/hooks/scripts/claude-pulse
node index.js
```

### 步骤5: 开始使用

在Telegram中向你的Bot发送：

```
/menu
```

你会看到交互式主菜单，点击按钮即可操作！

## 常用操作

### 查看系统状态

**方式1: 使用菜单**
```
/menu → 点击 "📊 系统状态"
```

**方式2: 使用命令**
```
/status
```

**方式3: 自然语言**
```
查看状态
```

### 查看错误日志

**方式1: 使用菜单**
```
/menu → 点击 "❌ 错误日志"
```

**方式2: 使用命令**
```
/logs error
```

**方式3: 自然语言**
```
有什么错误吗
```

### 查看会话列表

**方式1: 使用菜单**
```
/menu → 点击 "📋 活跃会话"
```

**方式2: 使用命令**
```
/sessions
```

**方式3: 自然语言**
```
看看会话
```

### 查看会话详情

**方式1: 从会话列表**
```
/sessions → 点击会话按钮
```

**方式2: 使用命令**
```
/session Project-7
```

### 获取智能建议

**方式1: 使用菜单**
```
/menu → 点击 "💡 智能建议"
```

**方式2: 从状态页面**
```
/status → 点击 "💡 智能建议"
```

## 内联键盘导航

### 主菜单结构

```
🤖 Claude Pulse 远程控制

[📊 系统状态] [📋 活跃会话]
[📝 查看日志] [📈 工作统计]
[❌ 错误日志] [⚠️ 警告日志]
[💡 智能建议] [❓ 帮助]
```

### 导航路径示例

#### 路径1: 查看系统状态
```
/menu
  → 📊 系统状态
    → 📋 查看会话 / 📝 查看日志 / 📈 查看统计
    → 🔄 刷新状态
    → 📱 主菜单（返回）
```

#### 路径2: 查看会话详情
```
/menu
  → 📋 活跃会话
    → 📂 Project-7...（点击会话）
      → 查看会话详情
      → 📋 返回会话列表
      → 📱 主菜单（返回）
```

#### 路径3: 查看错误日志
```
/menu
  → ❌ 错误日志
    → 📝 全部日志 / ⚠️ 警告日志
    → 🔄 刷新
    → 📱 主菜单（返回）
```

## 自然语言命令

### 支持的自然语言

| 你说 | Bot理解为 |
|------|----------|
| 查看状态 | `/status` |
| 看看会话 | `/sessions` |
| 显示日志 | `/logs` |
| 有什么错误吗 | `/logs error` |
| 查看警告 | `/logs warn` |
| 帮助 | `/help` |
| 打开菜单 | `/menu` |

### 自然语言示例

```
你: 查看状态
Bot: 📊 Claude Code 状态
     ⏰ 运行时间: 2小时 15分钟
     💾 内存使用: 145 MB
     ...

你: 有什么错误吗
Bot: 📝 最近日志 (错误)
     [显示错误日志]

你: 看看会话
Bot: 📋 活跃会话 (5)
     [显示会话列表]
```

## 智能建议

系统会根据当前状态自动生成建议：

### 建议类型

1. **错误日志建议**
   ```
   发现 2536 个错误日志
   建议查看错误日志以排查问题
   [❌ 查看错误]
   ```

2. **警告日志建议**
   ```
   发现 15 个警告日志
   建议查看警告日志
   [⚠️ 查看警告]
   ```

3. **内存使用建议**
   ```
   内存使用较高 (512 MB)
   建议查看系统状态
   [📊 查看状态]
   ```

4. **运行时间建议**
   ```
   系统已运行 3 天
   运行稳定，可以查看统计信息
   [📈 查看统计]
   ```

## 命令历史

### 使用 /repeat

```
你: /logs error
Bot: [显示错误日志]

你: /status
Bot: [显示系统状态]

你: /repeat
Bot: [再次显示系统状态]
```

系统会自动记录你的最近50条命令，使用 `/repeat` 可以快速重复上一条命令。

## 权限管理

### 权限级别

| 角色 | 权限说明 | 可用功能 |
|------|---------|---------|
| **admin** | 管理员 | 所有功能 |
| **user** | 普通用户 | 查看状态、会话、日志、统计 |
| **viewer** | 访客 | 仅查看状态和帮助 |

### 添加新用户

1. 获取新用户的Chat ID
2. 编辑 `config.json`：

```json
{
  "allowedChatIds": ["6145538033", "新用户Chat ID"],
  "userPermissions": {
    "6145538033": "admin",
    "新用户Chat ID": "user"
  }
}
```

3. 重启Claude Pulse

## 故障排除

### Bot不响应

**检查清单：**
- [ ] Bot Token是否正确
- [ ] Chat ID是否在allowedChatIds中
- [ ] Claude Pulse是否正在运行
- [ ] 网络连接是否正常

**查看日志：**
```bash
tail -f ~/.claude/logs/claude-pulse.log
```

### 内联键盘按钮不工作

**可能原因：**
1. Bot Token过期 → 重新生成Token
2. 回调处理器未注册 → 检查代码
3. 权限不足 → 检查userPermissions配置

### 自然语言识别不准确

**解决方案：**
1. 使用标准命令（如 `/status`）
2. 使用内联键盘按钮
3. 查看支持的自然语言列表

## 高级技巧

### 技巧1: 快速查看错误

```
/menu → ❌ 错误日志
```

一键直达错误日志，无需输入命令。

### 技巧2: 使用智能建议

```
/menu → 💡 智能建议
```

系统会根据当前状态推荐最需要关注的内容。

### 技巧3: 会话快速导航

```
/sessions → 点击会话按钮
```

直接点击会话名称查看详情，无需输入会话名。

### 技巧4: 命令重复执行

```
/logs error → /repeat
```

快速重复上一条命令，适合需要刷新的场景。

## 下一步

- 📖 阅读完整文档：`docs/REMOTE-CONTROL-ENHANCED.md`
- 🧪 运行测试：`node test-remote-control-enhanced.js`
- 🔧 自定义配置：编辑 `config.json`
- 💡 探索更多功能：发送 `/help` 查看所有命令

## 获取帮助

遇到问题？

1. 查看日志：`~/.claude/logs/claude-pulse.log`
2. 运行测试：`node test-remote-control-enhanced.js`
3. 查看文档：`docs/REMOTE-CONTROL-ENHANCED.md`
4. 发送 `/help` 查看命令列表

---

**祝你使用愉快！** 🎉

如有问题或建议，欢迎反馈。
