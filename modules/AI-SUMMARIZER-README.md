# AI智能摘要模块

## 概述

AI智能摘要模块使用Claude API分析会话内容，生成简洁的中文摘要，并对错误消息进行优先级分析。

## 功能特性

### 1. 会话内容摘要
- 分析Claude Code会话内容
- 生成15字以内的简洁中文摘要
- 例如："开发Telegram监控系统"、"修复登录bug"

### 2. 错误优先级分析
- 分析错误消息
- 返回优先级：critical/high/normal/low
- 帮助快速识别严重问题

### 3. 技术特点
- 使用原生https模块调用API
- 支持自定义base URL（代理服务）
- 重试机制（最多3次，指数退避）
- 超时处理（10秒超时）
- Token消耗优化（每次约100 tokens）

## 文件结构

```
modules/
├── ai-summarizer.js          # 真实API版本
└── ai-summarizer-mock.js     # 模拟版本（用于测试）

test-ai-summarizer.js         # 真实API测试脚本
test-ai-summarizer-mock.js    # Mock版本测试脚本
test-proxy-api.js             # 代理服务测试脚本
```

## 配置

### config.json

```json
{
  "modules": {
    "ai-summarizer": {
      "enabled": true,
      "model": "claude-3-5-sonnet-20241022",
      "baseUrl": "https://luckycodecc.cn/claude",
      "claudeApiKey": "your-api-key-here",
      "description": "AI智能摘要模块"
    }
  }
}
```

### 配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `enabled` | 是否启用模块 | `true` |
| `model` | Claude模型名称 | `claude-3-5-sonnet-20241022` |
| `baseUrl` | API base URL（可选） | `https://api.anthropic.com` |
| `claudeApiKey` | Claude API key | 从环境变量`CLAUDE_API_KEY`获取 |

## 使用方法

### 1. 基本使用

```javascript
const AISummarizer = require('./modules/ai-summarizer');

// 创建实例
const summarizer = new AISummarizer('ai-summarizer', config, core);

// 生成会话摘要
const summary = await summarizer.summarizeSession(sessionContent);
console.log('摘要:', summary);

// 分析错误优先级
const priority = await summarizer.analyzeError(errorMessage);
console.log('优先级:', priority);
```

### 2. 集成到其他模块

```javascript
// 在其他模块中使用
class SessionTracker extends HeartbeatModule {
  async onSessionEnd(sessionContent) {
    // 获取AI摘要
    const summarizer = this.core.getModule('ai-summarizer');
    const summary = await summarizer.summarizeSession(sessionContent);

    // 发送通知
    await this.notify(`会话结束: ${summary}`);
  }
}
```

## API参考

### summarizeSession(sessionContent)

分析会话内容，生成摘要。

**参数:**
- `sessionContent` (string): 会话内容

**返回:**
- `Promise<string|null>`: 摘要文本，失败时返回null

**示例:**
```javascript
const summary = await summarizer.summarizeSession(`
User: 帮我开发一个Telegram bot
Claude: 好的，我来帮你
`);
// 返回: "开发Telegram机器人"
```

### analyzeError(errorMessage)

分析错误消息，判断优先级。

**参数:**
- `errorMessage` (string): 错误消息

**返回:**
- `Promise<string>`: 优先级 (critical/high/normal/low)

**示例:**
```javascript
const priority = await summarizer.analyzeError('FATAL: Database crashed');
// 返回: "critical"
```

## 测试

### 运行真实API测试

```bash
# 设置API key
export CLAUDE_API_KEY="your-api-key"

# 运行测试
node test-ai-summarizer.js
```

### 运行Mock版本测试

```bash
# 不需要API key
node test-ai-summarizer-mock.js
```

### 测试代理服务连接

```bash
node test-proxy-api.js
```

## 错误处理

### 无API Key
- 会话摘要返回`null`
- 错误分析返回`normal`
- 记录警告日志

### API调用失败
- 自动重试（最多3次）
- 指数退避（2^n秒）
- 超时后返回默认值

### 网络错误
- 捕获并记录错误
- 返回默认值
- 不影响其他模块运行

## 性能优化

### Token消耗
- 每次摘要约100 tokens
- 提取关键消息（前5条+后5条）
- 避免发送完整会话内容

### 重试策略
- 第1次失败：等待2秒
- 第2次失败：等待4秒
- 第3次失败：放弃并返回默认值

### 超时设置
- 单次请求超时：10秒
- 避免长时间hang住

## Mock版本

当无法连接真实API时，可以使用Mock版本进行测试和开发。

### 特点
- 基于规则引擎的关键词匹配
- 不需要API key
- 响应速度快
- 适合开发和测试

### 使用方法

```javascript
const AISummarizerMock = require('./modules/ai-summarizer-mock');

const summarizer = new AISummarizerMock('ai-summarizer-mock', config, core);
```

## 注意事项

1. **API费用**: 每次调用消耗约100 tokens，请注意API配额
2. **速率限制**: 遵守Claude API的速率限制
3. **隐私**: 不要发送敏感信息到API
4. **代理服务**: 如果使用代理服务，确保配置正确的base URL

## 更新日志

### v1.0.0 (2026-02-09)
- ✅ 实现会话内容摘要功能
- ✅ 实现错误优先级分析功能
- ✅ 添加重试机制和超时处理
- ✅ 支持自定义base URL（代理服务）
- ✅ 创建Mock版本用于测试
- ✅ 完整的测试覆盖

## 作者

Claude Opus 4.6 (1M context)

## 许可证

MIT
