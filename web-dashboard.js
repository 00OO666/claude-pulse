/**
 * Web Dashboard - 网页监控面板
 *
 * 提供Web界面查看ClaudePulse状态
 * 使用Express + WebSocket实现实时通信
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

class WebDashboard {
  constructor(core, config) {
    this.core = core;
    this.port = config.port || 3000;
    this.app = null;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * 启动Web服务器
   */
  start() {
    // 创建Express应用
    this.app = express();

    // 静态文件服务
    this.app.use(express.static(path.join(__dirname, 'public')));

    // API路由
    this.setupRoutes();

    // 创建HTTP服务器
    this.server = http.createServer(this.app);

    // 创建WebSocket服务器
    this.wss = new WebSocket.Server({ server: this.server });
    this.setupWebSocket();

    // 监听端口
    this.server.listen(this.port, () => {
      this.core.log(`Dashboard running at http://localhost:${this.port}`, 'info');
      this.core.log(`Dashboard V3 (Enhanced) available at http://localhost:${this.port}/v3/`, 'info');
    });

    // 监听核心事件，实时推送到客户端
    this.setupEventListeners();
  }

  /**
   * 设置API路由
   */
  setupRoutes() {
    // 状态API
    this.app.get('/api/status', (req, res) => {
      res.json(this.getStatus());
    });

    // 会话列表API
    this.app.get('/api/sessions', (req, res) => {
      res.json(this.getSessions());
    });

    // 历史数据API
    this.app.get('/api/history', (req, res) => {
      res.json(this.getHistory());
    });

    // 日志API
    this.app.get('/api/logs', (req, res) => {
      const logs = this.getLogs(100);
      res.json(logs);
    });

    // 配置API
    this.app.get('/api/config', (req, res) => {
      res.json(this.getConfig());
    });

    // 系统信息API
    this.app.get('/api/system', (req, res) => {
      res.json(this.core.getSystemInfo());
    });

    // 远程控制API
    this.app.post('/api/control/:action', express.json(), (req, res) => {
      this.handleControl(req.params.action, req.body, res);
    });
  }

  /**
   * 设置WebSocket
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      this.core.log('Dashboard client connected', 'info');

      // 发送初始数据
      ws.send(JSON.stringify({
        type: 'init',
        data: {
          status: this.getStatus(),
          sessions: this.getSessions(),
          system: this.core.getSystemInfo()
        }
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
        this.core.log('Dashboard client disconnected', 'info');
      });

      ws.on('error', (error) => {
        this.core.log(`WebSocket error: ${error.message}`, 'error');
      });
    });
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听会话事件
    this.core.on('session:start', (data) => {
      this.broadcast({ type: 'session:start', data });
    });

    this.core.on('session:end', (data) => {
      this.broadcast({ type: 'session:end', data });
    });

    this.core.on('session:message', (data) => {
      this.broadcast({ type: 'session:message', data });
    });

    // 监听错误事件
    this.core.on('error:detected', (data) => {
      this.broadcast({ type: 'error', data });
    });
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * 获取状态数据
   */
  getStatus() {
    const sessionTracker = this.core.modules.get('session-tracker');
    if (!sessionTracker) {
      return { activeSessions: 0, totalMessages: 0, totalErrors: 0 };
    }

    const sessions = Array.from(sessionTracker.sessions.values());
    const activeSessions = sessions.filter(s => s.isActive);

    return {
      activeSessions: activeSessions.length,
      totalSessions: sessions.length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
      totalErrors: sessions.reduce((sum, s) => sum + s.errors, 0),
      uptime: this.core.getSystemInfo().uptime
    };
  }

  /**
   * 获取会话列表
   */
  getSessions() {
    const sessionTracker = this.core.modules.get('session-tracker');
    if (!sessionTracker) {
      return [];
    }

    const sessions = Array.from(sessionTracker.sessions.values());

    return sessions
      .filter(s => s.isActive)
      .map(s => ({
        id: s.id,
        topic: sessionTracker.extractSessionTopic(s),
        duration: sessionTracker.formatDuration(s.startTime, s.lastActivity),
        messageCount: s.messageCount,
        errors: s.errors,
        startTime: s.startTime,
        lastActivity: s.lastActivity
      }))
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * 获取历史数据
   */
  getHistory() {
    const sessionTracker = this.core.modules.get('session-tracker');
    if (!sessionTracker) {
      return { hourly: [], daily: [] };
    }

    const sessions = Array.from(sessionTracker.sessions.values());
    const now = Date.now();

    // 最近24小时的数据（每小时一个点）
    const hourly = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = now - i * 3600000;
      const hourEnd = hourStart + 3600000;

      const hourSessions = sessions.filter(s =>
        s.startTime >= hourStart && s.startTime < hourEnd
      );

      hourly.push({
        time: new Date(hourStart).toISOString(),
        sessions: hourSessions.length,
        messages: hourSessions.reduce((sum, s) => sum + s.messageCount, 0),
        errors: hourSessions.reduce((sum, s) => sum + s.errors, 0)
      });
    }

    return { hourly };
  }

  /**
   * 获取日志
   */
  getLogs(limit = 100) {
    const logFile = this.core.config.logging?.logFile;
    if (!logFile || !fs.existsSync(logFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n');
      return lines.slice(-limit).reverse();
    } catch (error) {
      this.core.log(`Failed to read logs: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * 获取配置
   */
  getConfig() {
    return {
      modules: Object.keys(this.core.config.modules || {}),
      logging: this.core.config.logging?.enabled || false,
      telegram: !!this.core.config.telegram?.botToken
    };
  }

  /**
   * 处理远程控制
   */
  handleControl(action, body, res) {
    const remoteControl = this.core.modules.get('remote-control');

    if (!remoteControl) {
      return res.status(503).json({ error: 'Remote control module not available' });
    }

    // 这里可以添加更多控制命令
    switch (action) {
      case 'restart':
        res.json({ success: true, message: 'Restart command sent' });
        break;
      case 'stop':
        res.json({ success: true, message: 'Stop command sent' });
        break;
      default:
        res.status(400).json({ error: 'Unknown action' });
    }
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    this.core.log('Dashboard stopped', 'info');
  }
}

module.exports = WebDashboard;
