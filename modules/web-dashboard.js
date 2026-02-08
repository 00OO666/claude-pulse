/**
 * Web Dashboard Module - Web监控面板模块
 *
 * 提供Web界面查看ClaudePulse状态
 */

const HeartbeatModule = require('../module-interface');
const WebDashboard = require('../web-dashboard');

class WebDashboardModule extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);
    this.dashboard = null;
  }

  /**
   * 初始化模块
   */
  async init() {
    this.dashboard = new WebDashboard(this.core, this.config);
    this.log('Web Dashboard module initialized');
  }

  /**
   * 启动模块
   */
  async start() {
    if (!this.enabled) {
      this.log('Module is disabled, skipping start');
      return;
    }

    this.log('Starting Web Dashboard...');
    this.running = true;

    try {
      this.dashboard.start();
      this.log(`Web Dashboard started on port ${this.config.port || 3000}`);
    } catch (error) {
      this.log(`Failed to start Web Dashboard: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 停止模块
   */
  async stop() {
    if (this.dashboard) {
      this.dashboard.stop();
    }
    this.running = false;
    this.log('Web Dashboard stopped');
  }

  /**
   * 执行方法（Web Dashboard不需要定时执行）
   */
  async execute() {
    // Web Dashboard是事件驱动的，不需要定时执行
  }
}

module.exports = WebDashboardModule;
