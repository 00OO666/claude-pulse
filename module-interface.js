/**
 * Module Interface - 模块接口定义
 *
 * 所有功能模块必须继承此基类
 */

class HeartbeatModule {
  /**
   * @param {string} name - 模块名称
   * @param {object} config - 模块配置
   * @param {object} core - 核心实例引用
   */
  constructor(name, config, core) {
    this.name = name;
    this.config = config;
    this.core = core;
    this.enabled = config.enabled !== false;
    this.interval = config.interval || 60000; // 默认1分钟
    this.timer = null;
    this.running = false;
  }

  /**
   * 初始化模块
   * 子类可以重写此方法进行初始化操作
   */
  async init() {
    this.log('Module initialized');
  }

  /**
   * 启动模块
   * 子类可以重写此方法定义启动逻辑
   */
  async start() {
    if (!this.enabled) {
      this.log('Module is disabled, skipping start');
      return;
    }

    this.log('Module starting...');
    this.running = true;

    // 立即执行一次
    await this.execute();

    // 设置定时器
    if (this.interval > 0) {
      this.timer = setInterval(async () => {
        await this.execute();
      }, this.interval);
    }

    this.log(`Module started (interval: ${this.interval}ms)`);
  }

  /**
   * 停止模块
   */
  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.log('Module stopped');
  }

  /**
   * 销毁模块
   * 子类可以重写此方法进行清理操作
   */
  async destroy() {
    await this.stop();
    this.log('Module destroyed');
  }

  /**
   * 执行模块任务
   * 子类必须实现此方法
   */
  async execute() {
    throw new Error(`Module ${this.name} must implement execute() method`);
  }

  /**
   * 发送通知
   * @param {string} message - 消息内容
   * @param {object} options - 通知选项
   */
  async notify(message, options = {}) {
    return this.core.notify(message, options);
  }

  /**
   * 记录日志
   * @param {string} message - 日志消息
   * @param {string} level - 日志级别
   */
  log(message, level = 'info') {
    this.core.log(`[${this.name}] ${message}`, level);
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   */
  emit(event, data) {
    this.core.emit(event, data);
  }

  /**
   * 监听事件
   * @param {string} event - 事件名称
   * @param {function} handler - 事件处理函数
   */
  on(event, handler) {
    this.core.on(event, handler);
  }
}

module.exports = HeartbeatModule;
