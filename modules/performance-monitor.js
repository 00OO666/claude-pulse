/**
 * Performance Monitor Module - 性能监控模块
 *
 * 功能：
 * 1. 监控各模块性能指标
 * 2. 自动优化建议
 * 3. 资源使用分析
 * 4. 瓶颈检测
 * 5. 性能报告生成
 */

const HeartbeatModule = require('../module-interface');
const os = require('os');

class PerformanceMonitor extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 配置
    this.monitorInterval = config.monitorInterval || 5000; // 5秒
    this.historySize = config.historySize || 100; // 保留100个数据点
    this.thresholds = config.thresholds || {
      cpu: 80, // CPU 使用率阈值
      memory: 80, // 内存使用率阈值
      moduleExecutionTime: 1000, // 模块执行时间阈值（毫秒）
      eventQueueSize: 100 // 事件队列大小阈值
    };

    // 性能数据
    this.performanceData = {
      system: [],
      modules: new Map(),
      events: []
    };

    // 瓶颈检测
    this.bottlenecks = [];

    // 优化建议
    this.recommendations = [];

    // 监控定时器
    this.monitorTimer = null;
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();

    // 开始监控
    this.startMonitoring();

    // 监听模块事件
    this.listenToModuleEvents();

    this.log('info', 'Performance Monitor initialized');
  }

  /**
   * 开始监控
   */
  startMonitoring() {
    this.monitorTimer = setInterval(() => {
      this.collectSystemMetrics();
      this.collectModuleMetrics();
      this.detectBottlenecks();
      this.generateRecommendations();
    }, this.monitorInterval);
  }

  /**
   * 收集系统指标
   */
  collectSystemMetrics() {
    const metrics = {
      timestamp: Date.now(),
      cpu: {
        usage: this.getCPUUsage(),
        loadAverage: os.loadavg()
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },
      uptime: os.uptime(),
      platform: os.platform()
    };

    this.performanceData.system.push(metrics);

    // 保持历史数据大小
    if (this.performanceData.system.length > this.historySize) {
      this.performanceData.system.shift();
    }

    return metrics;
  }

  /**
   * 获取 CPU 使用率
   */
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  /**
   * 收集模块指标
   */
  collectModuleMetrics() {
    for (const [moduleName, module] of this.core.modules) {
      if (!this.performanceData.modules.has(moduleName)) {
        this.performanceData.modules.set(moduleName, []);
      }

      const metrics = {
        timestamp: Date.now(),
        enabled: module.enabled,
        eventCount: module.eventEmitter ? module.eventEmitter.listenerCount() : 0,
        // 如果模块有性能统计，收集它们
        stats: module.getStats ? module.getStats() : null
      };

      const moduleData = this.performanceData.modules.get(moduleName);
      moduleData.push(metrics);

      // 保持历史数据大小
      if (moduleData.length > this.historySize) {
        moduleData.shift();
      }
    }
  }

  /**
   * 监听模块事件
   */
  listenToModuleEvents() {
    // 监听所有模块的事件执行时间
    for (const [moduleName, module] of this.core.modules) {
      if (module.eventEmitter) {
        const originalEmit = module.eventEmitter.emit.bind(module.eventEmitter);
        module.eventEmitter.emit = (...args) => {
          const startTime = Date.now();
          const result = originalEmit(...args);
          const duration = Date.now() - startTime;

          // 记录事件
          this.recordEvent({
            module: moduleName,
            event: args[0],
            duration,
            timestamp: Date.now()
          });

          return result;
        };
      }
    }
  }

  /**
   * 记录事件
   */
  recordEvent(eventData) {
    this.performanceData.events.push(eventData);

    // 保持历史数据大小
    if (this.performanceData.events.length > this.historySize * 10) {
      this.performanceData.events.shift();
    }

    // 检查是否超过阈值
    if (eventData.duration > this.thresholds.moduleExecutionTime) {
      this.log('warn', `Slow event detected: ${eventData.module}.${eventData.event} took ${eventData.duration}ms`);
    }
  }

  /**
   * 检测瓶颈
   */
  detectBottlenecks() {
    this.bottlenecks = [];

    // 检查系统资源
    const latestSystem = this.performanceData.system[this.performanceData.system.length - 1];
    if (latestSystem) {
      if (latestSystem.cpu.usage > this.thresholds.cpu) {
        this.bottlenecks.push({
          type: 'cpu',
          severity: 'high',
          message: `CPU usage is ${latestSystem.cpu.usage.toFixed(1)}% (threshold: ${this.thresholds.cpu}%)`,
          value: latestSystem.cpu.usage
        });
      }

      if (latestSystem.memory.usagePercent > this.thresholds.memory) {
        this.bottlenecks.push({
          type: 'memory',
          severity: 'high',
          message: `Memory usage is ${latestSystem.memory.usagePercent.toFixed(1)}% (threshold: ${this.thresholds.memory}%)`,
          value: latestSystem.memory.usagePercent
        });
      }
    }

    // 检查慢事件
    const recentEvents = this.performanceData.events.slice(-50);
    const slowEvents = recentEvents.filter(e => e.duration > this.thresholds.moduleExecutionTime);
    if (slowEvents.length > 5) {
      this.bottlenecks.push({
        type: 'slow-events',
        severity: 'medium',
        message: `${slowEvents.length} slow events detected in the last 50 events`,
        events: slowEvents
      });
    }

    // 检查模块性能
    for (const [moduleName, moduleData] of this.performanceData.modules) {
      const latestData = moduleData[moduleData.length - 1];
      if (latestData && latestData.stats) {
        // 如果模块有错误统计
        if (latestData.stats.errors > 10) {
          this.bottlenecks.push({
            type: 'module-errors',
            severity: 'high',
            message: `Module ${moduleName} has ${latestData.stats.errors} errors`,
            module: moduleName,
            value: latestData.stats.errors
          });
        }
      }
    }

    // 触发瓶颈事件
    if (this.bottlenecks.length > 0) {
      this.emit('performance:bottleneck', this.bottlenecks);
    }
  }

  /**
   * 生成优化建议
   */
  generateRecommendations() {
    this.recommendations = [];

    // 基于瓶颈生成建议
    for (const bottleneck of this.bottlenecks) {
      switch (bottleneck.type) {
        case 'cpu':
          this.recommendations.push({
            type: 'optimization',
            priority: 'high',
            message: 'Consider reducing monitoring frequency or disabling non-essential modules',
            action: 'reduce-monitoring-frequency'
          });
          break;

        case 'memory':
          this.recommendations.push({
            type: 'optimization',
            priority: 'high',
            message: 'Consider clearing caches or reducing history size',
            action: 'clear-caches'
          });
          break;

        case 'slow-events':
          this.recommendations.push({
            type: 'optimization',
            priority: 'medium',
            message: 'Some events are taking too long. Consider optimizing event handlers',
            action: 'optimize-event-handlers'
          });
          break;

        case 'module-errors':
          this.recommendations.push({
            type: 'fix',
            priority: 'high',
            message: `Module ${bottleneck.module} has too many errors. Check logs for details`,
            action: 'check-module-logs',
            module: bottleneck.module
          });
          break;
      }
    }

    // 触发建议事件
    if (this.recommendations.length > 0) {
      this.emit('performance:recommendations', this.recommendations);
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    const latestSystem = this.performanceData.system[this.performanceData.system.length - 1];
    const recentEvents = this.performanceData.events.slice(-100);

    // 计算平均事件执行时间
    const avgEventDuration = recentEvents.length > 0
      ? recentEvents.reduce((sum, e) => sum + e.duration, 0) / recentEvents.length
      : 0;

    // 找出最慢的事件
    const slowestEvents = [...recentEvents]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // 模块统计
    const moduleStats = {};
    for (const [moduleName, moduleData] of this.performanceData.modules) {
      const latestData = moduleData[moduleData.length - 1];
      moduleStats[moduleName] = latestData;
    }

    return {
      timestamp: Date.now(),
      system: latestSystem,
      events: {
        total: recentEvents.length,
        averageDuration: avgEventDuration,
        slowest: slowestEvents
      },
      modules: moduleStats,
      bottlenecks: this.bottlenecks,
      recommendations: this.recommendations
    };
  }

  /**
   * 应用优化建议
   */
  async applyOptimization(action) {
    this.log('info', `Applying optimization: ${action}`);

    switch (action) {
      case 'reduce-monitoring-frequency':
        this.monitorInterval = Math.min(this.monitorInterval * 2, 60000); // 最多60秒
        clearInterval(this.monitorTimer);
        this.startMonitoring();
        this.log('info', `Monitoring interval increased to ${this.monitorInterval}ms`);
        break;

      case 'clear-caches':
        // 清理所有模块的缓存
        for (const [moduleName, module] of this.core.modules) {
          if (module.clearCache) {
            await module.clearCache();
            this.log('info', `Cleared cache for module: ${moduleName}`);
          }
        }
        break;

      case 'optimize-event-handlers':
        this.log('info', 'Event handler optimization requires manual intervention');
        break;

      case 'check-module-logs':
        this.log('info', 'Please check module logs for error details');
        break;

      default:
        this.log('warn', `Unknown optimization action: ${action}`);
    }

    this.emit('performance:optimization-applied', { action });
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      systemDataPoints: this.performanceData.system.length,
      moduleCount: this.performanceData.modules.size,
      eventCount: this.performanceData.events.length,
      bottleneckCount: this.bottlenecks.length,
      recommendationCount: this.recommendations.length,
      monitorInterval: this.monitorInterval
    };
  }

  /**
   * 清理模块
   */
  async cleanup() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    await super.cleanup();
  }
}

module.exports = PerformanceMonitor;
