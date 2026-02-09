# ClaudePulse Dashboard V3 - Enhanced Version

## 功能特性

### ✅ 已实现

1. **自定义布局**
   - 使用 GridStack.js 实现拖拽调整布局
   - 自动保存布局到 localStorage
   - 响应式设计

2. **更多图表类型**
   - Chart.js: 折线图、柱状图
   - ECharts: 饼图、雷达图
   - 交互式图表（缩放、筛选）

3. **PWA支持**
   - manifest.json 配置
   - Service Worker 离线支持
   - 可安装为桌面应用

4. **实时通知**
   - 浏览器推送通知（Notification API）
   - 应用内通知系统
   - WebSocket 实时更新

5. **高级搜索和过滤**
   - 会话搜索功能
   - 实时过滤

6. **主题定制**
   - Light/Dark 主题切换
   - 主题持久化

### 🚧 待完善

1. **用户认证**
   - 简单的登录系统
   - JWT token
   - 权限管理

2. **数据导出**
   - CSV、JSON、PDF格式
   - 自定义导出模板

3. **更多布局预设**
   - 紧凑布局
   - 宽屏布局
   - 极简布局

## 使用方法

### 访问 V3 版本

```
http://localhost:3000/v3/
```

### 安装为 PWA

1. 在浏览器中打开 Dashboard V3
2. 点击地址栏右侧的"安装"图标
3. 确认安装

### 自定义布局

1. 点击顶部导航栏的"⚙️"按钮
2. 拖拽卡片调整位置和大小
3. 布局会自动保存

### 启用通知

1. 首次访问时会请求通知权限
2. 允许通知后，会收到实时推送

## 技术栈

- **前端框架**: Vanilla JavaScript (ES6+)
- **UI框架**: TailwindCSS
- **图表库**: Chart.js + ECharts
- **布局库**: GridStack.js
- **PWA**: Service Worker + Manifest
- **实时通信**: WebSocket

## 文件结构

```
public/v3/
├── index.html          # 主页面
├── app.js              # 前端应用逻辑
├── styles.css          # 自定义样式
├── manifest.json       # PWA 配置
├── service-worker.js   # Service Worker
└── README.md           # 说明文档
```

## 开发计划

### Phase 1 (已完成)
- [x] 基础布局和 GridStack 集成
- [x] Chart.js 和 ECharts 图表
- [x] PWA 支持
- [x] 实时通知
- [x] 主题切换

### Phase 2 (进行中)
- [ ] 用户认证系统
- [ ] 数据导出功能
- [ ] 更多布局预设
- [ ] 高级搜索功能

### Phase 3 (计划中)
- [ ] 数据分析和报表
- [ ] 自定义仪表盘
- [ ] 多用户支持
- [ ] API 文档

## 注意事项

1. **浏览器兼容性**: 需要现代浏览器（Chrome 90+, Firefox 88+, Safari 14+）
2. **Service Worker**: 需要 HTTPS 或 localhost 环境
3. **通知权限**: 需要用户手动授权

## 更新日志

### v3.0.0 (2026-02-09)
- 初始版本发布
- 实现核心功能
- PWA 支持
- 拖拽布局
- 高级图表

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
