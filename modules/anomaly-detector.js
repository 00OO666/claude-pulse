/**
 * Anomaly Detector Module - 异常检测模块
 *
 * 功能：
 * 1. AI识别异常资源使用模式
 * 2. 自动告警
 * 3. 异常分析报告
 * 4. 使用统计方法检测异常（Z-score、移动平均、IQR等）
 */

const HeartbeatModule = require('../module-interface');

class AnomalyDetector extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 异常检测配置
    this.windowSize = config.windowSize || 20; // 滑动窗口大小
    this.zScoreThreshold = config.zScoreThreshold || 3; // Z-score阈值
    this.iqrMultiplier = config.iqrMultiplier || 1.5; // IQR倍数

    // 数据窗口（用于统计分析）
    this.dataWindows = {
      cpu: [],
      memory: [],
      disk: [],
      network: [],
      errors: [],
      toolCalls: []
    };

    // 异常记录
    this.anomalies = [];
    this.maxAnomaliesHistory = config.maxAnomaliesHistory || 100;

    // 告警冷却期
    this.lastAlertTime = {};
    this.alertCooldown = config.alertCooldown || 5 * 60 * 1000; // 5分钟

    // 监听系统数据事件
    this.on('system:data-collected', (event) => {
      this.analyzeSystemData(event.data);
    });

    // 监听会话事件
    this.on('session:activity', (event) => {
      this.analyzeSessionActivity(event);
    });
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();
    this.log('Anomaly detector initialized');
  }

  /**
   * 执行异常检测任务
   */
  async execute() {
    try {
      // 生成异常报告
      const report = this.generateAnomalyReport();

      // 如果有新异常，发送通知
      if (report.recentAnomalies.length > 0) {
        await this.notifyAnomalies(report);
      }

      // 触发事件
      this.emit('anomaly:report-generated', report);

      this.log(`Anomaly detection completed, found ${report.recentAnomalies.length} recent anomalies`, 'debug');

    } catch (error) {
      this.log(`Failed to execute anomaly detector: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 分析系统数据
   */
  analyzeSystemData(data) {
    try {
      // 提取关键指标
      const metrics = {
        cpu: data.cpu?.usage || 0,
        memory: data.memory?.usedPercent || 0,
        disk: data.disk?.usage || 0,
        network: (data.network?.rx || 0) + (data.network?.tx || 0)
      };

      // 检测每个指标的异常
      for (const [metric, value] of Object.entries(metrics)) {
        this.addDataPoint(metric, value);
        const anomaly = this.detectAnomaly(metric, value);

        if (anomaly) {
          this.recordAnomaly({
            type: 'system',
            metric: metric,
            value: value,
            ...anomaly,
            timestamp: Date.now()
          });
        }
      }

    } catch (error) {
      this.log(`Failed to analyze system data: ${error.message}`, 'error');
    }
  }

  /**
   * 分析会话活动
   */
  analyzeSessionActivity(event) {
    try {
      // 检测错误率异常
      if (event.errors !== undefined) {
        this.addDataPoint('errors', event.errors);
        const anomaly = this.detectAnomaly('errors', event.errors);

        if (anomaly) {
          this.recordAnomaly({
            type: 'session',
            metric: 'errors',
            value: event.errors,
            ...anomaly,
            timestamp: Date.now()
          });
        }
      }

      // 检测工具调用异常
      if (event.toolCalls !== undefined) {
        this.addDataPoint('toolCalls', event.toolCalls);
        const anomaly = this.detectAnomaly('toolCalls', event.toolCalls);

        if (anomaly) {
          this.recordAnomaly({
            type: 'session',
            metric: 'toolCalls',
            value: event.toolCalls,
            ...anomaly,
            timestamp: Date.now()
          });
        }
      }

    } catch (error) {
      this.log(`Failed to analyze session activity: ${error.message}`, 'error');
    }
  }

  /**
   * 添加数据点到窗口
   */
  addDataPoint(metric, value) {
    if (!this.dataWindows[metric]) {
      this.dataWindows[metric] = [];
    }

    this.dataWindows[metric].push(value);

    // 保持窗口大小
    if (this.dataWindows[metric].length > this.windowSize) {
      this.dataWindows[metric].shift();
    }
  }

  /**
   * 检测异常（使用多种统计方法）
   */
  detectAnomaly(metric, value) {
    const window = this.dataWindows[metric];

    // 需要足够的数据点
    if (window.length < 10) {
      return null;
    }

    // 方法1: Z-score检测
    const zScore = this.calculateZScore(window, value);
    if (Math.abs(zScore) > this.zScoreThreshold) {
      return {
        method: 'z-score',
        score: zScore,
        severity: this.calculateSeverity(zScore),
        description: `Z-score异常: ${zScore.toFixed(2)} (阈值: ${this.zScoreThreshold})`
      };
    }

    // 方法2: IQR检测（四分位距）
    const iqrAnomaly = this.detectIQRAnomaly(window, value);
    if (iqrAnomaly) {
      return {
        method: 'iqr',
        ...iqrAnomaly,
        description: `IQR异常: 值超出正常范围`
      };
    }

    // 方法3: 移动平均偏差检测
    const maAnomaly = this.detectMovingAverageAnomaly(window, value);
    if (maAnomaly) {
      return {
        method: 'moving-average',
        ...maAnomaly,
        description: `移动平均偏差异常`
      };
    }

    return null;
  }

  /**
   * 计算Z-score
   */
  calculateZScore(window, value) {
    const mean = this.calculateMean(window);
    const stdDev = this.calculateStdDev(window, mean);

    if (stdDev === 0) return 0;

    return (value - mean) / stdDev;
  }

  /**
   * IQR异常检测
   */
  detectIQRAnomaly(window, value) {
    const sorted = [...window].sort((a, b) => a - b);
    const q1 = this.calculatePercentile(sorted, 25);
    const q3 = this.calculatePercentile(sorted, 75);
    const iqr = q3 - q1;

    const lowerBound = q1 - this.iqrMultiplier * iqr;
    const upperBound = q3 + this.iqrMultiplier * iqr;

    if (value < lowerBound || value > upperBound) {
      const severity = value < lowerBound
        ? this.calculateSeverity((lowerBound - value) / iqr)
        : this.calculateSeverity((value - upperBound) / iqr);

      return {
        score: value < lowerBound ? (lowerBound - value) / iqr : (value - upperBound) / iqr,
        severity: severity,
        bounds: { lower: lowerBound, upper: upperBound }
      };
    }

    return null;
  }

  /**
   * 移动平均偏差检测
   */
  detectMovingAverageAnomaly(window, value) {
    const ma = this.calculateMean(window);
    const deviation = Math.abs(value - ma) / ma;

    // 如果偏差超过50%，认为是异常
    if (deviation > 0.5) {
      return {
        score: deviation,
        severity: this.calculateSeverity(deviation * 2),
        movingAverage: ma
      };
    }

    return null;
  }

  /**
   * 计算均值
   */
  calculateMean(data) {
    if (data.length === 0) return 0;
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  /**
   * 计算标准差
   */
  calculateStdDev(data, mean) {
    if (data.length === 0) return 0;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
  }

  /**
   * 计算百分位数
   */
  calculatePercentile(sortedData, percentile) {
    const index = (percentile / 100) * (sortedData.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedData[lower] * (1 - weight) + sortedData[upper] * weight;
  }

  /**
   * 计算严重程度
   */
  calculateSeverity(score) {
    const absScore = Math.abs(score);

    if (absScore >= 5) return 'critical';
    if (absScore >= 4) return 'high';
    if (absScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * 记录异常
   */
  recordAnomaly(anomaly) {
    this.anomalies.push(anomaly);

    // 保持历史记录大小
    if (this.anomalies.length > this.maxAnomaliesHistory) {
      this.anomalies.shift();
    }

    // 触发事件
    this.emit('anomaly:detected', anomaly);

    this.log(`Anomaly detected: ${anomaly.metric} = ${anomaly.value} (${anomaly.severity})`, 'warn');
  }

  /**
   * 生成异常报告
   */
  generateAnomalyReport() {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const lastHour = now - 60 * 60 * 1000;

    // 筛选最近的异常
    const recentAnomalies = this.anomalies.filter(a => a.timestamp > lastHour);
    const last24hAnomalies = this.anomalies.filter(a => a.timestamp > last24h);

    // 按指标分组
    const anomaliesByMetric = {};
    for (const anomaly of last24hAnomalies) {
      if (!anomaliesByMetric[anomaly.metric]) {
        anomaliesByMetric[anomaly.metric] = [];
      }
      anomaliesByMetric[anomaly.metric].push(anomaly);
    }

    // 统计严重程度
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const anomaly of last24hAnomalies) {
      severityCounts[anomaly.severity]++;
    }

    return {
      timestamp: now,
      recentAnomalies: recentAnomalies,
      last24hAnomalies: last24hAnomalies,
      anomaliesByMetric: anomaliesByMetric,
      severityCounts: severityCounts,
      totalAnomalies: this.anomalies.length
    };
  }

  /**
   * 发送异常通知
   */
  async notifyAnomalies(report) {
    try {
      // 检查冷却期
      const now = Date.now();
      if (this.lastAlertTime.anomaly && (now - this.lastAlertTime.anomaly) < this.alertCooldown) {
        return;
      }

      // 只通知严重的异常
      const criticalAnomalies = report.recentAnomalies.filter(a => a.severity === 'critical' || a.severity === 'high');

      if (criticalAnomalies.length === 0) {
        return;
      }

      // 构建通知消息
      const message = this.buildAnomalyMessage(criticalAnomalies, report);

      await this.notify(message, {
        title: '⚠️ 异常检测告警',
        priority: 'high'
      });

      this.lastAlertTime.anomaly = now;

    } catch (error) {
      this.log(`Failed to send anomaly notification: ${error.message}`, 'error');
    }
  }

  /**
   * 构建异常消息
   */
  buildAnomalyMessage(anomalies, report) {
    const lines = ['检测到系统异常：\n'];

    // 按严重程度分组
    const critical = anomalies.filter(a => a.severity === 'critical');
    const high = anomalies.filter(a => a.severity === 'high');

    if (critical.length > 0) {
      lines.push(`🔴 严重异常 (${critical.length}):`);
      for (const anomaly of critical.slice(0, 3)) {
        lines.push(`  • ${this.formatAnomaly(anomaly)}`);
      }
      lines.push('');
    }

    if (high.length > 0) {
      lines.push(`🟠 高级异常 (${high.length}):`);
      for (const anomaly of high.slice(0, 3)) {
        lines.push(`  • ${this.formatAnomaly(anomaly)}`);
      }
      lines.push('');
    }

    // 添加统计信息
    lines.push(`📊 24小时统计:`);
    lines.push(`  总异常: ${report.last24hAnomalies.length}`);
    lines.push(`  严重: ${report.severityCounts.critical}, 高级: ${report.severityCounts.high}`);

    return lines.join('\n');
  }

  /**
   * 格式化异常信息
   */
  formatAnomaly(anomaly) {
    const metricNames = {
      cpu: 'CPU',
      memory: '内存',
      disk: '磁盘',
      network: '网络',
      errors: '错误',
      toolCalls: '工具调用'
    };

    const metricName = metricNames[anomaly.metric] || anomaly.metric;
    return `${metricName}: ${anomaly.value.toFixed(2)} (${anomaly.description})`;
  }

  /**
   * 获取异常历史
   */
  getAnomalyHistory(options = {}) {
    const { metric, severity, limit = 50 } = options;

    let filtered = [...this.anomalies];

    if (metric) {
      filtered = filtered.filter(a => a.metric === metric);
    }

    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }

    return filtered.slice(-limit);
  }

  /**
   * 清除异常历史
   */
  clearAnomalyHistory() {
    this.anomalies = [];
    this.log('Anomaly history cleared');
  }
}

module.exports = AnomalyDetector;
