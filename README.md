# ClaudePulse 🫀

> Keep your finger on Claude's pulse

ClaudePulse is a comprehensive monitoring and notification system for Claude Code CLI. It provides real-time activity tracking, error alerts, session management, remote control, work statistics, AI-powered insights, and system resource monitoring through multiple notification channels.

## ✨ Features

### 🤖 AI-Powered Insights (v2.0)
- **Intelligent Session Summaries**: AI analyzes your work sessions and generates concise summaries
- **Smart Error Prioritization**: Automatically categorizes errors by severity (CRITICAL/HIGH/MEDIUM/LOW)
- **Context-Aware Analysis**: Understands your workflow and provides relevant insights
- **Powered by Claude**: Uses Claude 3.5 Sonnet for deep understanding

### 🖥️ Web Dashboard (v2.0)
- **Real-time Monitoring**: Live system status and metrics visualization
- **Interactive Charts**: CPU, memory, disk, and network usage graphs
- **Remote Control Panel**: Execute commands from your browser
- **Process Management**: View and control Claude processes
- **Responsive Design**: Works on desktop and mobile devices

### 🎮 Advanced Process Control (v2.0)
- **Process Management**: Pause, resume, and restart Claude processes
- **Safe Operations**: Graceful shutdown with state preservation
- **Multi-Process Support**: Handle multiple Claude instances
- **Status Monitoring**: Real-time process health checks

### ⌨️ Keyboard Simulation (v2.0)
- **Remote Input**: Send keyboard commands to Claude remotely
- **Hotkey Support**: Trigger shortcuts and macros
- **Text Input**: Type text into Claude interface
- **Cross-Platform**: Works on Windows, macOS, and Linux

### 📢 Multi-Channel Notifications (v2.0)
- **Multiple Channels**: Telegram, Discord, Slack, Email
- **Smart Routing**: Route notifications based on priority and type
- **Rule-Based Filtering**: Customize notification rules
- **Fallback Support**: Automatic failover to backup channels

### 📊 System Resource Monitoring (v2.0)
- **CPU Monitoring**: Track overall and per-core CPU usage
- **Memory Tracking**: Monitor RAM usage with alerts
- **Disk Space**: Track disk usage across all drives
- **Network Stats**: Monitor network I/O and bandwidth
- **Process Tracking**: Monitor Claude process resource usage
- **Smart Alerts**: Configurable thresholds with intelligent alerting

### 🔍 Activity Monitoring
- Real-time file change detection
- Inactivity alerts (30-minute threshold)
- New session notifications
- 10-minute alert cooldown to prevent spam

### 🚨 Error Alerts
- Real-time log monitoring
- Intelligent error parsing (JSON and text formats)
- Formatted Telegram alerts with error details
- Stack trace and context information

### 📊 Session Tracking
- Track active Claude Code sessions
- Session start/resume/end notifications
- Work summary with statistics
- Hourly progress reports
- Window position detection (3×3 matrix)
- Desktop identification

### 🎮 Remote Control
- Telegram bot integration
- Commands:
  - `/status` - View Claude Code status
  - `/sessions` - List active sessions
  - `/logs [lines]` - View recent logs
  - `/stats` - View work statistics
  - `/help` - Show help message
- Security: Chat ID whitelist

### 📈 Work Statistics
- Daily/weekly work reports
- Message and tool call counting
- File operation tracking
- Error statistics
- Token consumption tracking (if available)

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- Claude Code CLI
- Telegram Bot Token

### Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/yourusername/claude-pulse.git
cd claude-pulse
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Configure:
\`\`\`bash
cp config.example.json config.json
# Edit config.json with your settings
\`\`\`

4. Start ClaudePulse:
\`\`\`bash
# Windows (PowerShell)
pwsh start-claude-pulse.ps1

# Linux/Mac
node index.js
\`\`\`

## ⚙️ Configuration

Edit \`config.json\`:

\`\`\`json
{
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN",
    "chatId": "YOUR_CHAT_ID"
  },
  "modules": {
    "activity-monitor": {
      "enabled": true,
      "interval": 60000
    },
    "error-alert": {
      "enabled": true,
      "interval": 30000
    },
    "session-tracker": {
      "enabled": true,
      "interval": 60000
    },
    "remote-control": {
      "enabled": true,
      "interval": 5000
    },
    "work-stats": {
      "enabled": true,
      "interval": 3600000
    }
  }
}
\`\`\`

## 📁 Project Structure

\`\`\`
claude-pulse/
├── heartbeat-core.js       # Core framework
├── module-interface.js     # Module base class
├── index.js                # Entry point
├── web-dashboard.js        # Web dashboard server
├── config.json             # Configuration
├── modules/                # Feature modules
│   ├── ai-summarizer.js           # AI智能摘要
│   ├── activity-monitor.js        # 活动监控
│   ├── error-alert.js             # 错误告警
│   ├── session-tracker.js         # 会话追踪
│   ├── remote-control.js          # 远程控制
│   ├── work-stats.js              # 工作统计
│   ├── process-controller.js      # 进程控制
│   ├── keyboard-controller.js     # 键盘模拟
│   ├── notification-router.js     # 通知路由
│   ├── system-monitor.js          # 系统监控
│   └── notifiers/                 # 通知器
│       ├── telegram.js
│       ├── discord.js
│       ├── slack.js
│       └── email.js
├── public/                 # Web dashboard assets
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── docs/                   # Documentation
│   ├── README.md
│   ├── CONFIG.md
│   └── TROUBLESHOOTING.md
└── start-claude-pulse.ps1  # Startup script (Windows)
\`\`\`

## 🏗️ Architecture

ClaudePulse uses a modular plugin architecture:

- **Event-Driven**: Modules communicate via events
- **Lifecycle Management**: Standard init/start/stop/destroy lifecycle
- **Configuration-Driven**: Easy to enable/disable modules
- **Extensible**: Easy to add new modules

## 📱 Notification Examples

### Session Start
\`\`\`
🚀 会话开始

📍 位置: 桌面1 - 2-3
📝 主题: ClaudePulse Development
📂 目录: F:\Project-7
🌿 分支: main
⏰ 时间: 2026/2/9 06:00

✅ 会话已激活，开始追踪工作内容
\`\`\`

### Session End
\`\`\`
🏁 会话结束

📍 位置: 桌面1 - 2-3
📝 主题: ClaudePulse Development
📂 目录: F:\Project-7
⏱️ 时长: 1小时30分钟

📊 工作成果:
  💬 消息数量: 45
  🔧 工具调用: 89
  📝 文件操作: 15

✅ 会话已结束
\`\`\`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Inspired by [OpenClaw](https://github.com/openclaw/openclaw)
- Built for [Claude Code CLI](https://github.com/anthropics/claude-code)

## 📞 Support

- Issues: [GitHub Issues](https://github.com/yourusername/claude-pulse/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/claude-pulse/discussions)

---

**Made with ❤️ by the Claude Code community**
