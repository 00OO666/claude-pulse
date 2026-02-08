/**
 * ClaudePulse Dashboard - 前端应用
 *
 * 功能：
 * 1. WebSocket实时通信
 * 2. 数据可视化（Chart.js）
 * 3. 暗色模式切换
 * 4. 响应式设计
 */

class DashboardApp {
  constructor() {
    this.ws = null;
    this.charts = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;

    this.init();
  }

  /**
   * 初始化应用
   */
  init() {
    // 初始化暗色模式
    this.initTheme();

    // 连接WebSocket
    this.connectWebSocket();

    // 初始化图表
    this.initCharts();

    // 绑定事件
    this.bindEvents();

    // 加载初始数据
    this.loadInitialData();
  }

  /**
   * 初始化主题
   */
  initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.getElementById('theme-toggle').innerHTML = '<span class="text-2xl">☀️</span>';
    }
  }

  /**
   * 连接WebSocket
   */
  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.updateConnectionStatus('connecting');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.updateConnectionStatus('connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.updateConnectionStatus('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus('disconnected');
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.updateConnectionStatus('disconnected');
    }
  }

  /**
   * 尝试重连
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
    }
  }

  /**
   * 更新连接状态
   */
  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connection-status');
    const statusMap = {
      connected: { text: '已连接', class: 'status-connected' },
      disconnected: { text: '已断开', class: 'status-disconnected' },
      connecting: { text: '连接中...', class: 'status-connecting' }
    };

    const { text, class: className } = statusMap[status];
    statusEl.textContent = text;
    statusEl.className = `text-sm ${className}`;
  }

  /**
   * 处理WebSocket消息
   */
  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'init':
          this.handleInitData(message.data);
          break;
        case 'session:start':
          this.handleSessionStart(message.data);
          break;
        case 'session:end':
          this.handleSessionEnd(message.data);
          break;
        case 'session:message':
          this.handleSessionMessage(message.data);
          break;
        case 'error':
          this.handleError(message.data);
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * 处理初始数据
   */
  handleInitData(data) {
    this.updateStatus(data.status);
    this.updateSessions(data.sessions);
    this.updateSystemInfo(data.system);
  }

  /**
   * 处理会话开始
   */
  handleSessionStart(data) {
    this.loadSessions();
    this.showNotification('新会话开始', 'success');
  }

  /**
   * 处理会话结束
   */
  handleSessionEnd(data) {
    this.loadSessions();
  }

  /**
   * 处理会话消息
   */
  handleSessionMessage(data) {
    this.loadStatus();
  }

  /**
   * 处理错误
   */
  handleError(data) {
    this.showNotification('检测到错误', 'error');
    this.loadStatus();
  }

  /**
   * 初始化图表
   */
  initCharts() {
    // 活动趋势图
    const activityCtx = document.getElementById('activity-chart');
    this.charts.activity = new Chart(activityCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: '会话数',
          data: [],
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });

    // 消息统计图
    const messageCtx = document.getElementById('message-chart');
    this.charts.message = new Chart(messageCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: '消息数',
          data: [],
          backgroundColor: 'rgba(16, 185, 129, 0.8)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 主题切换
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // 刷新会话
    document.getElementById('refresh-sessions').addEventListener('click', () => {
      this.loadSessions();
    });

    // 关闭模态框
    document.getElementById('close-modal').addEventListener('click', () => {
      this.closeModal();
    });

    // 点击模态框外部关闭
    document.getElementById('session-modal').addEventListener('click', (e) => {
      if (e.target.id === 'session-modal') {
        this.closeModal();
      }
    });
  }

  /**
   * 切换主题
   */
  toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    const themeToggle = document.getElementById('theme-toggle');

    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      themeToggle.innerHTML = '<span class="text-2xl">🌙</span>';
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      themeToggle.innerHTML = '<span class="text-2xl">☀️</span>';
    }

    // 更新图表主题
    this.updateChartTheme();
  }

  /**
   * 更新图表主题
   */
  updateChartTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#9ca3af' : '#4b5563';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    Object.values(this.charts).forEach(chart => {
      chart.options.scales.x.ticks.color = textColor;
      chart.options.scales.y.ticks.color = textColor;
      chart.options.scales.x.grid.color = gridColor;
      chart.options.scales.y.grid.color = gridColor;
      chart.update();
    });
  }

  /**
   * 加载初始数据
   */
  async loadInitialData() {
    await Promise.all([
      this.loadStatus(),
      this.loadSessions(),
      this.loadHistory(),
      this.loadSystemInfo(),
      this.loadLogs()
    ]);
  }

  /**
   * 加载状态
   */
  async loadStatus() {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      this.updateStatus(data);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  }

  /**
   * 更新状态显示
   */
  updateStatus(data) {
    document.getElementById('active-sessions').textContent = data.activeSessions || 0;
    document.getElementById('total-messages').textContent = data.totalMessages || 0;
    document.getElementById('total-errors').textContent = data.totalErrors || 0;
    document.getElementById('uptime').textContent = data.uptime || '-';
  }

  /**
   * 加载会话列表
   */
  async loadSessions() {
    try {
      const response = await fetch('/api/sessions');
      const sessions = await response.json();
      this.updateSessions(sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  /**
   * 更新会话列表显示
   */
  updateSessions(sessions) {
    const listEl = document.getElementById('session-list');

    if (sessions.length === 0) {
      listEl.innerHTML = `
        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
          暂无活跃会话
        </div>
      `;
      return;
    }

    listEl.innerHTML = sessions.map(session => `
      <div class="session-item" onclick="app.showSessionDetails('${session.id}')">
        <div class="session-header">
          <div class="session-topic">
            <span class="text-green-500">🟢</span>
            <span>${this.escapeHtml(session.topic)}</span>
          </div>
          <span class="session-status active">活跃</span>
        </div>
        <div class="session-meta">
          <span>⏱️ ${session.duration}</span>
          <span>💬 ${session.messageCount} 条消息</span>
          ${session.errors > 0 ? `<span class="text-red-500">⚠️ ${session.errors} 个错误</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  /**
   * 加载历史数据
   */
  async loadHistory() {
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      this.updateCharts(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  /**
   * 更新图表
   */
  updateCharts(data) {
    if (data.hourly && data.hourly.length > 0) {
      const labels = data.hourly.map(d => {
        const date = new Date(d.time);
        return `${date.getHours()}:00`;
      });

      // 更新活动趋势图
      this.charts.activity.data.labels = labels;
      this.charts.activity.data.datasets[0].data = data.hourly.map(d => d.sessions);
      this.charts.activity.update();

      // 更新消息统计图
      this.charts.message.data.labels = labels;
      this.charts.message.data.datasets[0].data = data.hourly.map(d => d.messages);
      this.charts.message.update();
    }
  }

  /**
   * 加载系统信息
   */
  async loadSystemInfo() {
    try {
      const response = await fetch('/api/system');
      const data = await response.json();
      this.updateSystemInfo(data);
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  }

  /**
   * 更新系统信息显示
   */
  updateSystemInfo(data) {
    document.getElementById('sys-hostname').textContent = data.hostname || '-';
    document.getElementById('sys-platform').textContent = data.platform || '-';
    document.getElementById('sys-memory').textContent = data.memory || '-';
  }

  /**
   * 加载日志
   */
  async loadLogs() {
    try {
      const response = await fetch('/api/logs');
      const logs = await response.json();
      this.updateLogs(logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  /**
   * 更新日志显示
   */
  updateLogs(logs) {
    const logsEl = document.getElementById('logs');

    if (logs.length === 0) {
      logsEl.innerHTML = '<div class="text-gray-500 dark:text-gray-400">暂无日志</div>';
      return;
    }

    logsEl.innerHTML = logs.map(log => {
      let className = 'log-line';
      if (log.includes('[ERROR]')) className += ' log-error';
      else if (log.includes('[WARN]')) className += ' log-warn';
      else if (log.includes('[INFO]')) className += ' log-info';

      return `<div class="${className}">${this.escapeHtml(log)}</div>`;
    }).join('');
  }

  /**
   * 显示会话详情
   */
  showSessionDetails(sessionId) {
    const modal = document.getElementById('session-modal');
    const details = document.getElementById('session-details');

    details.innerHTML = `
      <div class="space-y-4">
        <div>
          <h4 class="font-semibold mb-2">会话ID</h4>
          <p class="font-mono text-sm">${sessionId}</p>
        </div>
        <div>
          <h4 class="font-semibold mb-2">操作</h4>
          <button class="btn-danger" onclick="app.endSession('${sessionId}')">
            结束会话
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  /**
   * 关闭模态框
   */
  closeModal() {
    document.getElementById('session-modal').classList.add('hidden');
  }

  /**
   * 结束会话
   */
  async endSession(sessionId) {
    if (!confirm('确定要结束这个会话吗？')) {
      return;
    }

    try {
      this.showNotification('会话已结束', 'success');
      this.closeModal();
      this.loadSessions();
    } catch (error) {
      console.error('Failed to end session:', error);
      this.showNotification('结束会话失败', 'error');
    }
  }

  /**
   * 显示通知
   */
  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 初始化应用
const app = new DashboardApp();

// 定期刷新数据（每30秒）
setInterval(() => {
  app.loadStatus();
  app.loadHistory();
}, 30000);
