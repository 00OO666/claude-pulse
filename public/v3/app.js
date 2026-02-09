/**
 * ClaudePulse Dashboard V3 - Enhanced Frontend
 */

class DashboardV3 {
  constructor() {
    this.ws = null;
    this.charts = {};
    this.grid = null;
    this.sessions = [];
    this.init();
  }

  async init() {
    await this.registerServiceWorker();
    this.initTheme();
    this.initGridStack();
    this.connectWebSocket();
    setTimeout(() => this.initCharts(), 500);
    this.bindEvents();
    this.loadInitialData();
    this.requestNotificationPermission();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/v3/service-worker.js');
        console.log('Service Worker registered');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.innerHTML = '<span class="text-2xl">☀️</span>';
    }
  }

  initGridStack() {
    this.grid = GridStack.init({
      cellHeight: 80,
      margin: 10,
      float: true,
      animate: true
    });

    const savedLayout = localStorage.getItem('dashboard-layout');
    if (savedLayout) {
      this.grid.load(JSON.parse(savedLayout));
    } else {
      this.loadDefaultLayout();
    }

    this.grid.on('change', () => {
      const layout = this.grid.save();
      localStorage.setItem('dashboard-layout', JSON.stringify(layout));
    });
  }

  loadDefaultLayout() {
    const widgets = [
      { id: 'status', x: 0, y: 0, w: 3, h: 2, content: this.createStatusCard() },
      { id: 'activity', x: 3, y: 0, w: 6, h: 4, content: this.createActivityChart() },
      { id: 'message', x: 9, y: 0, w: 3, h: 4, content: this.createMessageChart() },
      { id: 'pie', x: 0, y: 2, w: 3, h: 4, content: this.createPieChart() },
      { id: 'radar', x: 3, y: 4, w: 3, h: 4, content: this.createRadarChart() },
      { id: 'sessions', x: 6, y: 4, w: 6, h: 6, content: this.createSessionList() },
      { id: 'system', x: 0, y: 6, w: 3, h: 3, content: this.createSystemInfo() },
      { id: 'logs', x: 3, y: 8, w: 3, h: 3, content: this.createLogs() }
    ];

    widgets.forEach(w => this.grid.addWidget(w));
  }

  createStatusCard() {
    return `<div class="card"><h2 class="card-title">系统状态</h2>
      <div class="grid grid-cols-2 gap-4 mt-4">
        <div class="stat-mini"><div class="stat-value" id="active-sessions">-</div><div class="stat-label">活跃会话</div></div>
        <div class="stat-mini"><div class="stat-value" id="total-messages">-</div><div class="stat-label">今日消息</div></div>
        <div class="stat-mini"><div class="stat-value" id="total-errors">-</div><div class="stat-label">错误数量</div></div>
        <div class="stat-mini"><div class="stat-value" id="uptime">-</div><div class="stat-label">运行时间</div></div>
      </div></div>`;
  }

  createActivityChart() {
    return `<div class="card"><h2 class="card-title">24小时活动趋势</h2>
      <canvas id="activity-chart-canvas" style="height: 250px;"></canvas></div>`;
  }

  createMessageChart() {
    return `<div class="card"><h2 class="card-title">消息统计</h2>
      <canvas id="message-chart-canvas" style="height: 250px;"></canvas></div>`;
  }

  createPieChart() {
    return `<div class="card"><h2 class="card-title">会话类型分布</h2>
      <div id="pie-chart-container" style="height: 250px;"></div></div>`;
  }

  createRadarChart() {
    return `<div class="card"><h2 class="card-title">性能指标</h2>
      <div id="radar-chart-container" style="height: 250px;"></div></div>`;
  }

  createSessionList() {
    return `<div class="card">
      <div class="flex justify-between items-center mb-4">
        <h2 class="card-title">活跃会话</h2>
        <div class="flex space-x-2">
          <input type="text" id="session-search" placeholder="搜索..."
                 class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <button id="refresh-sessions" class="btn-secondary text-sm px-3 py-1">🔄</button>
        </div>
      </div>
      <div id="session-list-content" class="space-y-3 max-h-96 overflow-y-auto">
        <div class="text-center text-gray-500 dark:text-gray-400 py-8">加载中...</div>
      </div></div>`;
  }

  createSystemInfo() {
    return `<div class="card"><h2 class="card-title">系统信息</h2>
      <div id="system-info-content" class="space-y-2 text-sm mt-4">
        <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">主机名:</span><span id="sys-hostname" class="font-mono">-</span></div>
        <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">平台:</span><span id="sys-platform" class="font-mono">-</span></div>
        <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">内存:</span><span id="sys-memory" class="font-mono">-</span></div>
      </div></div>`;
  }

  createLogs() {
    return `<div class="card"><h2 class="card-title">最近日志</h2>
      <div id="logs-content" class="space-y-1 text-xs font-mono max-h-64 overflow-y-auto mt-4">
        <div class="text-gray-500 dark:text-gray-400">加载中...</div>
      </div></div>`;
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => console.log('WebSocket connected');
      this.ws.onmessage = (event) => this.handleWebSocketMessage(event.data);
      this.ws.onclose = () => console.log('WebSocket disconnected');
      this.ws.onerror = (error) => console.error('WebSocket error:', error);
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }

  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case 'init':
          this.updateStatus(message.data.status);
          this.updateSessions(message.data.sessions);
          this.updateSystemInfo(message.data.system);
          break;
        case 'session:start':
          this.loadSessions();
          this.showNotification('新会话开始', 'success');
          break;
        case 'session:end':
          this.loadSessions();
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  initCharts() {
    this.initActivityChart();
    this.initMessageChart();
    this.initPieChart();
    this.initRadarChart();
  }

  initActivityChart() {
    const canvas = document.getElementById('activity-chart-canvas');
    if (!canvas) return;

    this.charts.activity = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: '会话数',
          data: [],
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  initMessageChart() {
    const canvas = document.getElementById('message-chart-canvas');
    if (!canvas) return;

    this.charts.message = new Chart(canvas, {
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
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  initPieChart() {
    const container = document.getElementById('pie-chart-container');
    if (!container) return;

    this.charts.pie = echarts.init(container);
    this.charts.pie.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', left: 'left' },
      series: [{
        name: '会话类型',
        type: 'pie',
        radius: '50%',
        data: [
          { value: 10, name: '开发' },
          { value: 5, name: '调试' },
          { value: 3, name: '测试' },
          { value: 2, name: '其他' }
        ]
      }]
    });
  }

  initRadarChart() {
    const container = document.getElementById('radar-chart-container');
    if (!container) return;

    this.charts.radar = echarts.init(container);
    this.charts.radar.setOption({
      tooltip: {},
      radar: {
        indicator: [
          { name: '响应速度', max: 100 },
          { name: '准确性', max: 100 },
          { name: '稳定性', max: 100 },
          { name: '资源使用', max: 100 },
          { name: '用户满意度', max: 100 }
        ]
      },
      series: [{
        name: '性能指标',
        type: 'radar',
        data: [{ value: [85, 90, 95, 80, 88], name: '当前性能' }]
      }]
    });
  }

  bindEvents() {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) searchBtn.addEventListener('click', () => this.showNotification('搜索功能开发中', 'info'));

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this.showNotification('导出功能开发中', 'info'));

    const layoutBtn = document.getElementById('layout-btn');
    if (layoutBtn) layoutBtn.addEventListener('click', () => this.showNotification('布局设置开发中', 'info'));

    setTimeout(() => {
      const searchInput = document.getElementById('session-search');
      if (searchInput) searchInput.addEventListener('input', (e) => this.filterSessions(e.target.value));

      const refreshBtn = document.getElementById('refresh-sessions');
      if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadSessions());
    }, 1000);
  }

  toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    const themeToggle = document.getElementById('theme-toggle');

    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      if (themeToggle) themeToggle.innerHTML = '<span class="text-2xl">🌙</span>';
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      if (themeToggle) themeToggle.innerHTML = '<span class="text-2xl">☀️</span>';
    }
  }

  async loadInitialData() {
    await Promise.all([
      this.loadStatus(),
      this.loadSessions(),
      this.loadHistory(),
      this.loadSystemInfo(),
      this.loadLogs()
    ]);
  }

  async loadStatus() {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      this.updateStatus(data);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  }

  updateStatus(data) {
    const el = (id) => document.getElementById(id);
    if (el('active-sessions')) el('active-sessions').textContent = data.activeSessions || 0;
    if (el('total-messages')) el('total-messages').textContent = data.totalMessages || 0;
    if (el('total-errors')) el('total-errors').textContent = data.totalErrors || 0;
    if (el('uptime')) el('uptime').textContent = data.uptime || '-';
  }

  async loadSessions() {
    try {
      const response = await fetch('/api/sessions');
      const sessions = await response.json();
      this.sessions = sessions;
      this.updateSessions(sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  updateSessions(sessions) {
    const listEl = document.getElementById('session-list-content');
    if (!listEl) return;

    if (sessions.length === 0) {
      listEl.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-8">暂无活跃会话</div>';
      return;
    }

    listEl.innerHTML = sessions.map(s => `
      <div class="session-item">
        <div class="flex justify-between items-start mb-2">
          <div class="flex items-center">
            <span class="text-green-500 mr-2">🟢</span>
            <span class="font-medium">${this.escapeHtml(s.topic)}</span>
          </div>
          <span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">活跃</span>
        </div>
        <div class="flex space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <span>⏱️ ${s.duration}</span>
          <span>💬 ${s.messageCount} 条消息</span>
          ${s.errors > 0 ? `<span class="text-red-500">⚠️ ${s.errors} 个错误</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  filterSessions(query) {
    const filtered = query ? this.sessions.filter(s => s.topic.toLowerCase().includes(query.toLowerCase())) : this.sessions;
    this.updateSessions(filtered);
  }

  async loadHistory() {
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      this.updateCharts(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  updateCharts(data) {
    if (data.hourly && data.hourly.length > 0) {
      const labels = data.hourly.map(d => `${new Date(d.time).getHours()}:00`);

      if (this.charts.activity) {
        this.charts.activity.data.labels = labels;
        this.charts.activity.data.datasets[0].data = data.hourly.map(d => d.sessions);
        this.charts.activity.update();
      }

      if (this.charts.message) {
        this.charts.message.data.labels = labels;
        this.charts.message.data.datasets[0].data = data.hourly.map(d => d.messages);
        this.charts.message.update();
      }
    }
  }

  async loadSystemInfo() {
    try {
      const response = await fetch('/api/system');
      const data = await response.json();
      this.updateSystemInfo(data);
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  }

  updateSystemInfo(data) {
    const el = (id) => document.getElementById(id);
    if (el('sys-hostname')) el('sys-hostname').textContent = data.hostname || '-';
    if (el('sys-platform')) el('sys-platform').textContent = data.platform || '-';
    if (el('sys-memory')) el('sys-memory').textContent = data.memory || '-';
  }

  async loadLogs() {
    try {
      const response = await fetch('/api/logs');
      const logs = await response.json();
      this.updateLogs(logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  updateLogs(logs) {
    const logsEl = document.getElementById('logs-content');
    if (!logsEl) return;

    if (logs.length === 0) {
      logsEl.innerHTML = '<div class="text-gray-500 dark:text-gray-400">暂无日志</div>';
      return;
    }

    logsEl.innerHTML = logs.slice(0, 20).map(log => {
      let className = 'text-gray-700 dark:text-gray-300';
      if (log.includes('[ERROR]')) className = 'text-red-500';
      else if (log.includes('[WARN]')) className = 'text-yellow-500';
      else if (log.includes('[INFO]')) className = 'text-blue-500';
      return `<div class="${className}">${this.escapeHtml(log)}</div>`;
    }).join('');
  }

  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="flex items-center justify-between">
        <span>${message}</span>
        <button class="ml-4 text-gray-500 hover:text-gray-700" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    container.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const app = new DashboardV3();
setInterval(() => {
  app.loadStatus();
  app.loadHistory();
}, 30000);
