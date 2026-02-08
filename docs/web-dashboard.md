# Web Dashboard

ClaudePulse的Web监控面板，提供实时状态展示和远程控制功能。

## 功能特性

### 1. 实时状态展示
- 活跃会话数量
- 今日消息统计
- 错误数量统计
- 系统运行时间

### 2. 会话管理
- 实时会话列表
- 会话详情查看
- 会话持续时间
- 消息数量统计

### 3. 数据可视化
- 24小时活动趋势图（Chart.js）
- 消息统计柱状图
- 实时数据更新

### 4. 系统监控
- 系统信息展示
- 实时日志查看
- 模块状态监控

### 5. 用户体验
- 响应式设计（支持手机访问）
- 暗色模式切换
- WebSocket实时通信
- 自动重连机制

## 技术栈

### 后端
- **Express.js** - Web服务器框架
- **WebSocket (ws)** - 实时双向通信
- **Node.js** - 运行环境

### 前端
- **TailwindCSS** - 现代化CSS框架
- **Chart.js** - 数据可视化
- **原生JavaScript** - 无框架依赖

## 安装依赖

```bash
cd C:/Users/666/.claude/hooks/scripts/claude-pulse
npm install
```

## 配置

在 `config.json` 中添加或修改：

```json
{
  "modules": {
    "web-dashboard": {
      "enabled": true,
      "port": 3000,
      "description": "Web监控面板"
    }
  }
}
```

## 启动

```bash
npm start
```

或者：

```bash
node index.js
```

## 访问

打开浏览器访问：

```
http://localhost:3000
```

## API端点

### GET /api/status
获取系统状态

**响应示例：**
```json
{
  "activeSessions": 2,
  "totalSessions": 10,
  "totalMessages": 150,
  "totalErrors": 3,
  "uptime": "2h 30m"
}
```

### GET /api/sessions
获取活跃会话列表

**响应示例：**
```json
[
  {
    "id": "session-123",
    "topic": "开发Web Dashboard",
    "duration": "1h 20m",
    "messageCount": 45,
    "errors": 0,
    "startTime": 1707456000000,
    "lastActivity": 1707460800000
  }
]
```

### GET /api/history
获取历史数据（24小时）

**响应示例：**
```json
{
  "hourly": [
    {
      "time": "2024-02-09T00:00:00.000Z",
      "sessions": 3,
      "messages": 50,
      "errors": 1
    }
  ]
}
```

### GET /api/logs
获取最近日志（默认100条）

### GET /api/system
获取系统信息

### GET /api/config
获取配置信息

## WebSocket事件

### 客户端接收的事件

#### init
初始化数据（连接时发送）

```json
{
  "type": "init",
  "data": {
    "status": {...},
    "sessions": [...],
    "system": {...}
  }
}
```

#### session:start
新会话开始

```json
{
  "type": "session:start",
  "data": {
    "id": "session-123",
    "topic": "..."
  }
}
```

#### session:end
会话结束

```json
{
  "type": "session:end",
  "data": {
    "id": "session-123"
  }
}
```

#### session:message
会话消息更新

```json
{
  "type": "session:message",
  "data": {
    "id": "session-123",
    "messageCount": 10
  }
}
```

#### error
错误检测

```json
{
  "type": "error",
  "data": {
    "message": "...",
    "level": "error"
  }
}
```

## 文件结构

```
claude-pulse/
├── web-dashboard.js          # Web服务器核心
├── modules/
│   └── web-dashboard.js      # 模块包装器
└── public/                   # 前端文件
    ├── index.html            # 主页面
    ├── styles.css            # 样式文件
    └── app.js                # 前端逻辑
```

## 开发说明

### 添加新的API端点

在 `web-dashboard.js` 的 `setupRoutes()` 方法中添加：

```javascript
this.app.get('/api/your-endpoint', (req, res) => {
  // 处理逻辑
  res.json({ data: 'your data' });
});
```

### 添加新的WebSocket事件

在 `web-dashboard.js` 的 `setupEventListeners()` 方法中添加：

```javascript
this.core.on('your:event', (data) => {
  this.broadcast({ type: 'your:event', data });
});
```

### 修改前端样式

编辑 `public/styles.css` 文件，使用TailwindCSS类或自定义CSS。

### 修改前端逻辑

编辑 `public/app.js` 文件，在 `DashboardApp` 类中添加新方法。

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 性能优化

- WebSocket自动重连（最多5次）
- 数据定期刷新（30秒）
- 图表按需更新
- 日志限制100条

## 安全建议

1. **生产环境**：建议添加身份验证
2. **HTTPS**：使用反向代理（如Nginx）添加SSL
3. **防火墙**：限制端口访问范围

## 故障排除

### 无法连接WebSocket

检查：
1. 服务器是否正常启动
2. 端口是否被占用
3. 防火墙是否阻止连接

### 图表不显示

检查：
1. Chart.js CDN是否加载成功
2. 浏览器控制台是否有错误
3. 数据是否正确返回

### 暗色模式不工作

检查：
1. localStorage是否可用
2. TailwindCSS是否正确加载

## 未来计划

- [ ] 添加用户认证
- [ ] 支持多语言
- [ ] 添加更多图表类型
- [ ] 导出数据功能
- [ ] 移动端App

## 许可证

MIT

## 作者

ClaudePulse Team
