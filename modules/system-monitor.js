/**
 * System Monitor Module - 系统资源监控模块
 *
 * 功能：
 * 1. 监控CPU使用率（总体和每核心）
 * 2. 监控内存占用（总量、已用、可用）
 * 3. 监控磁盘I/O（读写速度）
 * 4. 监控网络流量（上传/下载速度）
 * 5. 监控Claude Code进程资源
 * 6. 告警功能（阈值配置、冷却期）
 * 7. 数据导出API（当前数据、历史数据）
 */

const HeartbeatModule = require('../module-interface');
const si = require('systeminformation');

class SystemMonitor extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 历史数据存储（保留最近N条记录）
    this.maxHistorySize = config.maxHistorySize || 100;
    this.history = [];

    // 上一次的网络和磁盘数据（用于计算速度）
    this.lastNetworkStats = null;
    this.lastDiskStats = null;
    this.lastStatsTime = null;

    // 告警配置
    this.thresholds = {
      cpu: config.thresholds?.cpu || 80,        // CPU使用率阈值（%）
      memory: config.thresholds?.memory || 85,  // 内存使用率阈值（%）
      disk: config.thresholds?.disk || 90,      // 磁盘使用率阈值（%）
      networkRx: config.thresholds?.networkRx || 100 * 1024 * 1024, // 下载速度阈值（100MB/s）
      networkTx: config.thresholds?.networkTx || 100 * 1024 * 1024  // 上传速度阈值（100MB/s）
    };

    // 告警状态（用于冷却期）
    this.lastAlertTime = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0
    };
    this.alertCooldown = config.alertCooldown || 10 * 60 * 1000; // 10分钟冷却期

    // Claude Code进程名称
    this.claudeProcessName = config.claudeProcessName || 'claude';
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();
    this.log('System monitor initialized');
  }

  /**
   * 执行系统监控任务
   */
  async execute() {
    try {
      const now = Date.now();

      // 采集系统数据
      const systemData = await this.collectSystemData();

      // 存储到历史记录
      this.addToHistory(systemData);

      // 检查告警
      await this.checkAlerts(systemData);

      // 触发事件
      this.emit('system:data-collected', {
        timestamp: now,
        data: systemData
      });

      this.log('System data collected successfully', 'debug');

    } catch (error) {
      this.log(`Failed to execute system monitor: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 采集系统数据
   */
  async collectSystemData() {
    const now = Date.now();

    try {
      // 并行采集所有数据
      const [
        cpuData,
        memData,
        diskData,
        networkData,
        processData
      ] = await Promise.all([
        this.getCpuData(),
        this.getMemoryData(),
        this.getDiskData(),
        this.getNetworkData(),
        this.getClaudeProcessData()
      ]);

      return {
        timestamp: now,
        cpu: cpuData,
        memory: memData,
        disk: diskData,
        network: networkData,
        process: processData
      };

    } catch (error) {
      this.log(`Failed to collect system data: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 获取CPU数据
   */
  async getCpuData() {
    try {
      const cpuLoad = await si.currentLoad();
      const cpuTemp = await si.cpuTemperature();

      return {
        overall: Math.round(cpuLoad.currentLoad * 10) / 10,
        cores: cpuLoad.cpus.map(cpu => Math.round(cpu.load * 10) / 10),
        temperature: cpuTemp.main || null
      };
    } catch (error) {
      this.log(`Failed to get CPU data: ${error.message}`, 'error');
      return { overall: 0, cores: [], temperature: null };
    }
  }

  /**
   * 获取内存数据
   */
  async getMemoryData() {
    try {
      const mem = await si.mem();

      return {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        available: mem.available,
        usagePercent: Math.round((mem.used / mem.total) * 100 * 10) / 10
      };
    } catch (error) {
      this.log(`Failed to get memory data: ${error.message}`, 'error');
      return { total: 0, used: 0, free: 0, available: 0, usagePercent: 0 };
    }
  }

  /**
   * 获取磁盘数据
   */
  async getDiskData() {
    try {
      const [fsSize, diskIO] = await Promise.all([
        si.fsSize(),
        si.disksIO()
      ]);

      // 检查diskIO是否有效
      if (!diskIO || typeof diskIO !== 'object') {
        this.log('Disk I/O data not available', 'warn');
        return {
          filesystems: fsSize.map(fs => ({
            mount: fs.mount,
            size: fs.size,
            used: fs.used,
            available: fs.available,
            usagePercent: Math.round(fs.use * 10) / 10
          })),
          io: { read: 0, write: 0, readTotal: 0, writeTotal: 0 }
        };
      }

      // 计算磁盘I/O速度
      let ioSpeed = { read: 0, write: 0 };
      if (this.lastDiskStats && this.lastStatsTime && diskIO.rIO !== undefined && diskIO.wIO !== undefined) {
        const timeDiff = (Date.now() - this.lastStatsTime) / 1000; // 秒
        if (timeDiff > 0) {
          ioSpeed.read = Math.round((diskIO.rIO - this.lastDiskStats.rIO) / timeDiff);
          ioSpeed.write = Math.round((diskIO.wIO - this.lastDiskStats.wIO) / timeDiff);
        }
      }

      // 保存当前数据用于下次计算
      if (diskIO.rIO !== undefined && diskIO.wIO !== undefined) {
        this.lastDiskStats = {
          rIO: diskIO.rIO,
          wIO: diskIO.wIO
        };
      }

      return {
        filesystems: fsSize.map(fs => ({
          mount: fs.mount,
          size: fs.size,
          used: fs.used,
          available: fs.available,
          usagePercent: Math.round(fs.use * 10) / 10
        })),
        io: {
          read: ioSpeed.read,
          write: ioSpeed.write,
          readTotal: diskIO.rIO || 0,
          writeTotal: diskIO.wIO || 0
        }
      };
    } catch (error) {
      this.log(`Failed to get disk data: ${error.message}`, 'error');
      return { filesystems: [], io: { read: 0, write: 0, readTotal: 0, writeTotal: 0 } };
    }
  }

  /**
   * 获取网络数据
   */
  async getNetworkData() {
    try {
      const networkStats = await si.networkStats();

      // 计算网络速度
      let speed = { rx: 0, tx: 0 };
      if (this.lastNetworkStats && this.lastStatsTime) {
        const timeDiff = (Date.now() - this.lastStatsTime) / 1000; // 秒
        const mainInterface = networkStats[0];
        speed.rx = Math.round((mainInterface.rx_bytes - this.lastNetworkStats.rx_bytes) / timeDiff);
        speed.tx = Math.round((mainInterface.tx_bytes - this.lastNetworkStats.tx_bytes) / timeDiff);
      }

      // 保存当前数据用于下次计算
      if (networkStats.length > 0) {
        this.lastNetworkStats = {
          rx_bytes: networkStats[0].rx_bytes,
          tx_bytes: networkStats[0].tx_bytes
        };
      }
      this.lastStatsTime = Date.now();

      return {
        interfaces: networkStats.map(iface => ({
          iface: iface.iface,
          rx_bytes: iface.rx_bytes,
          tx_bytes: iface.tx_bytes,
          rx_sec: iface.rx_sec,
          tx_sec: iface.tx_sec
        })),
        speed: speed
      };
    } catch (error) {
      this.log(`Failed to get network data: ${error.message}`, 'error');
      return { interfaces: [], speed: { rx: 0, tx: 0 } };
    }
  }

  /**
   * 获取Claude Code进程数据
   */
  async getClaudeProcessData() {
    try {
      const processes = await si.processes();

      // 查找Claude相关进程
      const claudeProcesses = processes.list.filter(proc =>
        proc.name && proc.name.toLowerCase().includes(this.claudeProcessName.toLowerCase())
      );

      if (claudeProcesses.length === 0) {
        return { found: false, processes: [] };
      }

      return {
        found: true,
        processes: claudeProcesses.map(proc => ({
          pid: proc.pid,
          name: proc.name,
          cpu: Math.round(proc.cpu * 10) / 10,
          memory: proc.mem,
          memVsz: proc.memVsz,
          memRss: proc.memRss
        }))
      };
    } catch (error) {
      this.log(`Failed to get Claude process data: ${error.message}`, 'error');
      return { found: false, processes: [] };
    }
  }

  /**
   * 添加到历史记录
   */
  addToHistory(data) {
    this.history.push(data);

    // 保持历史记录大小限制
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * 检查告警
   */
  async checkAlerts(data) {
    const now = Date.now();

    // CPU告警
    if (data.cpu.overall > this.thresholds.cpu) {
      if (now - this.lastAlertTime.cpu > this.alertCooldown) {
        await this.sendAlert('cpu', data.cpu.overall, this.thresholds.cpu);
        this.lastAlertTime.cpu = now;
      }
    }

    // 内存告警
    if (data.memory.usagePercent > this.thresholds.memory) {
      if (now - this.lastAlertTime.memory > this.alertCooldown) {
        await this.sendAlert('memory', data.memory.usagePercent, this.thresholds.memory);
        this.lastAlertTime.memory = now;
      }
    }

    // 磁盘告警
    for (const fs of data.disk.filesystems) {
      if (fs.usagePercent > this.thresholds.disk) {
        if (now - this.lastAlertTime.disk > this.alertCooldown) {
          await this.sendAlert('disk', fs.usagePercent, this.thresholds.disk, fs.mount);
          this.lastAlertTime.disk = now;
        }
      }
    }

    // 网络告警
    if (data.network.speed.rx > this.thresholds.networkRx ||
        data.network.speed.tx > this.thresholds.networkTx) {
      if (now - this.lastAlertTime.network > this.alertCooldown) {
        await this.sendAlert('network', data.network.speed, this.thresholds);
        this.lastAlertTime.network = now;
      }
    }
  }

  /**
   * 发送告警
   */
  async sendAlert(type, value, threshold, extra = null) {
    let message = '';

    switch (type) {
      case 'cpu':
        message = `⚠️ <b>CPU使用率告警</b>\n\n🔴 当前: ${value}%\n📊 阈值: ${threshold}%\n⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`;
        break;

      case 'memory':
        message = `⚠️ <b>内存使用率告警</b>\n\n🔴 当前: ${value}%\n📊 阈值: ${threshold}%\n⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`;
        break;

      case 'disk':
        message = `⚠️ <b>磁盘使用率告警</b>\n\n🔴 当前: ${value}%\n📊 阈值: ${threshold}%\n💾 挂载点: ${extra}\n⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`;
        break;

      case 'network':
        const rxMB = Math.round(value.rx / 1024 / 1024 * 10) / 10;
        const txMB = Math.round(value.tx / 1024 / 1024 * 10) / 10;
        message = `⚠️ <b>网络流量告警</b>\n\n📥 下载: ${rxMB} MB/s\n📤 上传: ${txMB} MB/s\n⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`;
        break;
    }

    try {
      await this.notify(message);
      this.log(`Alert sent: ${type}`);
      this.emit('system:alert', { type, value, threshold, timestamp: Date.now() });
    } catch (error) {
      this.log(`Failed to send alert: ${error.message}`, 'error');
    }
  }

  /**
   * 获取当前数据
   */
  getCurrentData() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /**
   * 获取历史数据
   */
  getHistoryData(limit = null) {
    if (limit && limit < this.history.length) {
      return this.history.slice(-limit);
    }
    return this.history;
  }

  /**
   * 获取图表数据格式
   */
  getChartData(metric, limit = 50) {
    const data = this.getHistoryData(limit);

    return data.map(item => {
      let value;
      switch (metric) {
        case 'cpu':
          value = item.cpu.overall;
          break;
        case 'memory':
          value = item.memory.usagePercent;
          break;
        case 'network-rx':
          value = item.network.speed.rx;
          break;
        case 'network-tx':
          value = item.network.speed.tx;
          break;
        case 'disk-read':
          value = item.disk.io.read;
          break;
        case 'disk-write':
          value = item.disk.io.write;
          break;
        default:
          value = 0;
      }

      return {
        timestamp: item.timestamp,
        value: value
      };
    });
  }

  /**
   * 格式化字节大小
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 销毁模块
   */
  async destroy() {
    // 清理历史数据
    this.history = [];
    this.lastNetworkStats = null;
    this.lastDiskStats = null;

    await super.destroy();
    this.log('System monitor destroyed');
  }
}

module.exports = SystemMonitor;
