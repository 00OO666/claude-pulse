/**
 * Analytics Engine Module - 分析引擎模块
 *
 * 功能：
 * 1. 性能优化建议
 * 2. 趋势预测（资源需求、工作量、Token消耗）
 * 3. 容量规划
 * 4. 错误趋势分析
 * 5. 会话质量分析
 */

const HeartbeatModule = require('../module-interface');
const https = require('https');

class AnalyticsEngine extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // Claude API配置
    this.apiKey = config.claudeApiKey || process.env.CLAUDE_API_KEY;
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';

    // 解析base URL
    const url = new URL(this.baseUrl);
    this.hostname = url.hostname;
    this.port = url.port || 443;
    this.basePath = url.pathname === '/' ? '' : url.pathname;

    // 数据收集
    this.metricsHistory = {
      system: [],
      sessions: [],
      errors: [],
      performance: []
    };

    // 历史数据大小限制
    this.maxHistorySize = config.maxHistorySize || 1000;

    // 分析报告缓存
    this.lastAnalysisReport = null;
    this.lastAnalysisTime = 0;
    this.analysisCacheDuration = config.analysisCacheDuration || 30 * 60 * 1000; // 30分钟

    // 监听事件
    this.on('system:data-collected', (event) => {
      this.collectSystemMetrics(event);
    });

    this.on('session:activity', (event) => {
      this.collectSessionMetrics(event);
    });

    this.on('error:detected', (event) => {
      this.collectErrorMetrics(event);
    });
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();
    this.log('Analytics engine initialized');
  }

  /**
   * 执行分析任务
   */
  async execute() {
    try {
      // 生成综合分析报告
      const report = await this.generateAnalysisReport();

      // 触发事件
      this.emit('analytics:report-generated', report);

      this.log('Analytics report generated successfully', 'debug');

    } catch (error) {
      this.log(`Failed to execute analytics engine: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 收集系统指标
   */
  collectSystemMetrics(event) {
    try {
      const metrics = {
        timestamp: event.timestamp || Date.now(),
        cpu: event.data.cpu?.usage || 0,
        memory: event.data.memory?.usedPercent || 0,
        disk: event.data.disk?.usage || 0,
        network: {
          rx: event.data.network?.rx || 0,
          tx: event.data.network?.tx || 0
        }
      };

      this.metricsHistory.system.push(metrics);

      // 保持历史大小
      if (this.metricsHistory.system.length > this.maxHistorySize) {
        this.metricsHistory.system.shift();
      }

    } catch (error) {
      this.log(`Failed to collect system metrics: ${error.message}`, 'error');
    }
  }

  /**
   * 收集会话指标
   */
  collectSessionMetrics(event) {
    try {
      const metrics = {
        timestamp: Date.now(),
        sessionId: event.sessionId,
        messageCount: event.messageCount || 0,
        toolCalls: event.toolCalls || 0,
        errors: event.errors || 0,
        duration: event.duration || 0
      };

      this.metricsHistory.sessions.push(metrics);

      // 保持历史大小
      if (this.metricsHistory.sessions.length > this.maxHistorySize) {
        this.metricsHistory.sessions.shift();
      }

    } catch (error) {
      this.log(`Failed to collect session metrics: ${error.message}`, 'error');
    }
  }

  /**
   * 收集错误指标
   */
  collectErrorMetrics(event) {
    try {
      const metrics = {
        timestamp: Date.now(),
        type: event.type || 'unknown',
        message: event.message || '',
        severity: event.severity || 'medium'
      };

      this.metricsHistory.errors.push(metrics);

      // 保持历史大小
      if (this.metricsHistory.errors.length > this.maxHistorySize) {
        this.metricsHistory.errors.shift();
      }

    } catch (error) {
      this.log(`Failed to collect error metrics: ${error.message}`, 'error');
    }
  }

  /**
   * 生成综合分析报告
   */
  async generateAnalysisReport() {
    // 检查缓存
    const now = Date.now();
    if (this.lastAnalysisReport && (now - this.lastAnalysisTime) < this.analysisCacheDuration) {
      return this.lastAnalysisReport;
    }

    const report = {
      timestamp: now,
      performanceOptimization: await this.analyzePerformanceOptimization(),
      trendPrediction: this.analyzeTrends(),
      capacityPlanning: this.analyzeCapacity(),
      errorTrends: this.analyzeErrorTrends(),
      sessionQuality: this.analyzeSessionQuality()
    };

    // 缓存报告
    this.lastAnalysisReport = report;
    this.lastAnalysisTime = now;

    return report;
  }

  /**
   * 性能优化分析
   */
  async analyzePerformanceOptimization() {
    try {
      const systemMetrics = this.metricsHistory.system.slice(-100);

      if (systemMetrics.length < 10) {
        return {
          status: 'insufficient_data',
          recommendations: []
        };
      }

      // 计算平均值
      const avgCpu = this.calculateAverage(systemMetrics.map(m => m.cpu));
      const avgMemory = this.calculateAverage(systemMetrics.map(m => m.memory));
      const avgDisk = this.calculateAverage(systemMetrics.map(m => m.disk));

      // 生成优化建议
      const recommendations = [];

      if (avgCpu > 70) {
        recommendations.push({
          type: 'cpu',
          severity: 'high',
          issue: `CPU平均使用率过高 (${avgCpu.toFixed(1)}%)`,
          suggestions: [
            '考虑减少并发任务数量',
            '优化CPU密集型操作',
            '检查是否有后台进程占用过多CPU'
          ]
        });
      }

      if (avgMemory > 80) {
        recommendations.push({
          type: 'memory',
          severity: 'high',
          issue: `内存平均使用率过高 (${avgMemory.toFixed(1)}%)`,
          suggestions: [
            '考虑增加系统内存',
            '检查内存泄漏',
            '优化数据缓存策略'
          ]
        });
      }

      if (avgDisk > 85) {
        recommendations.push({
          type: 'disk',
          severity: 'medium',
          issue: `磁盘使用率过高 (${avgDisk.toFixed(1)}%)`,
          suggestions: [
            '清理临时文件和日志',
            '考虑扩展磁盘空间',
            '归档旧数据'
          ]
        });
      }

      // 使用AI生成深度分析（如果配置了API key）
      let aiAnalysis = null;
      if (this.apiKey && recommendations.length > 0) {
        aiAnalysis = await this.getAIOptimizationSuggestions(systemMetrics, recommendations);
      }

      return {
        status: 'analyzed',
        averages: {
          cpu: avgCpu,
          memory: avgMemory,
          disk: avgDisk
        },
        recommendations: recommendations,
        aiAnalysis: aiAnalysis
      };

    } catch (error) {
      this.log(`Failed to analyze performance optimization: ${error.message}`, 'error');
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 趋势预测分析
   */
  analyzeTrends() {
    try {
      const systemMetrics = this.metricsHistory.system.slice(-100);
      const sessionMetrics = this.metricsHistory.sessions.slice(-50);

      if (systemMetrics.length < 20) {
        return {
          status: 'insufficient_data'
        };
      }

      // 资源需求趋势
      const resourceTrend = this.calculateTrend(systemMetrics.map(m => ({
        timestamp: m.timestamp,
        value: (m.cpu + m.memory + m.disk) / 3
      })));

      // 工作量趋势
      const workloadTrend = sessionMetrics.length > 10
        ? this.calculateTrend(sessionMetrics.map(m => ({
            timestamp: m.timestamp,
            value: m.messageCount + m.toolCalls
          })))
        : null;

      // 预测未来7天的资源需求
      const predictions = this.predictFuture(resourceTrend, 7);

      return {
        status: 'analyzed',
        resourceTrend: {
          direction: resourceTrend.slope > 0 ? 'increasing' : 'decreasing',
          rate: Math.abs(resourceTrend.slope),
          confidence: resourceTrend.r2
        },
        workloadTrend: workloadTrend ? {
          direction: workloadTrend.slope > 0 ? 'increasing' : 'decreasing',
          rate: Math.abs(workloadTrend.slope),
          confidence: workloadTrend.r2
        } : null,
        predictions: predictions
      };

    } catch (error) {
      this.log(`Failed to analyze trends: ${error.message}`, 'error');
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 容量规划分析
   */
  analyzeCapacity() {
    try {
      const systemMetrics = this.metricsHistory.system.slice(-100);

      if (systemMetrics.length < 20) {
        return {
          status: 'insufficient_data'
        };
      }

      // 计算峰值和平均值
      const cpuValues = systemMetrics.map(m => m.cpu);
      const memoryValues = systemMetrics.map(m => m.memory);
      const diskValues = systemMetrics.map(m => m.disk);

      const capacity = {
        cpu: {
          average: this.calculateAverage(cpuValues),
          peak: Math.max(...cpuValues),
          p95: this.calculatePercentile(cpuValues, 95),
          headroom: 100 - Math.max(...cpuValues)
        },
        memory: {
          average: this.calculateAverage(memoryValues),
          peak: Math.max(...memoryValues),
          p95: this.calculatePercentile(memoryValues, 95),
          headroom: 100 - Math.max(...memoryValues)
        },
        disk: {
          average: this.calculateAverage(diskValues),
          peak: Math.max(...diskValues),
          p95: this.calculatePercentile(diskValues, 95),
          headroom: 100 - Math.max(...diskValues)
        }
      };

      // 生成扩容建议
      const recommendations = [];

      if (capacity.cpu.headroom < 20) {
        recommendations.push({
          resource: 'cpu',
          urgency: 'high',
          message: 'CPU容量即将耗尽，建议尽快扩容',
          suggestedIncrease: '50%'
        });
      }

      if (capacity.memory.headroom < 15) {
        recommendations.push({
          resource: 'memory',
          urgency: 'high',
          message: '内存容量紧张，建议增加内存',
          suggestedIncrease: '50%'
        });
      }

      if (capacity.disk.headroom < 10) {
        recommendations.push({
          resource: 'disk',
          urgency: 'critical',
          message: '磁盘空间严重不足，需要立即扩容',
          suggestedIncrease: '100%'
        });
      }

      return {
        status: 'analyzed',
        capacity: capacity,
        recommendations: recommendations
      };

    } catch (error) {
      this.log(`Failed to analyze capacity: ${error.message}`, 'error');
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 错误趋势分析
   */
  analyzeErrorTrends() {
    try {
      const errors = this.metricsHistory.errors.slice(-100);

      if (errors.length < 5) {
        return {
          status: 'insufficient_data'
        };
      }

      // 按类型分组
      const errorsByType = {};
      for (const error of errors) {
        if (!errorsByType[error.type]) {
          errorsByType[error.type] = [];
        }
        errorsByType[error.type].push(error);
      }

      // 识别重复错误
      const repeatedErrors = Object.entries(errorsByType)
        .filter(([type, errs]) => errs.length >= 3)
        .map(([type, errs]) => ({
          type: type,
          count: errs.length,
          firstSeen: errs[0].timestamp,
          lastSeen: errs[errs.length - 1].timestamp,
          frequency: errs.length / ((errs[errs.length - 1].timestamp - errs[0].timestamp) / (60 * 60 * 1000))
        }));

      // 计算错误率趋势
      const errorRateTrend = this.calculateTrend(
        this.groupByTimeWindow(errors, 60 * 60 * 1000).map(group => ({
          timestamp: group.timestamp,
          value: group.count
        }))
      );

      return {
        status: 'analyzed',
        totalErrors: errors.length,
        errorsByType: Object.keys(errorsByType).map(type => ({
          type: type,
          count: errorsByType[type].length
        })),
        repeatedErrors: repeatedErrors,
        errorRateTrend: {
          direction: errorRateTrend.slope > 0 ? 'increasing' : 'decreasing',
          rate: Math.abs(errorRateTrend.slope)
        }
      };

    } catch (error) {
      this.log(`Failed to analyze error trends: ${error.message}`, 'error');
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 会话质量分析
   */
  analyzeSessionQuality() {
    try {
      const sessions = this.metricsHistory.sessions.slice(-50);

      if (sessions.length < 5) {
        return {
          status: 'insufficient_data'
        };
      }

      // 计算质量指标
      const avgMessagesPerSession = this.calculateAverage(sessions.map(s => s.messageCount));
      const avgToolCallsPerSession = this.calculateAverage(sessions.map(s => s.toolCalls));
      const avgErrorsPerSession = this.calculateAverage(sessions.map(s => s.errors));
      const avgDuration = this.calculateAverage(sessions.map(s => s.duration));

      // 计算效率分数（0-100）
      const efficiencyScore = this.calculateEfficiencyScore({
        avgMessages: avgMessagesPerSession,
        avgToolCalls: avgToolCallsPerSession,
        avgErrors: avgErrorsPerSession,
        avgDuration: avgDuration
      });

      // 生成改进建议
      const improvements = [];

      if (avgErrorsPerSession > 2) {
        improvements.push({
          area: 'error_rate',
          message: '会话错误率较高，建议优化错误处理',
          priority: 'high'
        });
      }

      if (avgToolCallsPerSession < 5) {
        improvements.push({
          area: 'tool_usage',
          message: '工具使用率较低，可能影响工作效率',
          priority: 'medium'
        });
      }

      if (avgDuration > 60 * 60 * 1000) {
        improvements.push({
          area: 'session_duration',
          message: '会话时长较长，建议适当休息',
          priority: 'low'
        });
      }

      return {
        status: 'analyzed',
        metrics: {
          avgMessagesPerSession: avgMessagesPerSession,
          avgToolCallsPerSession: avgToolCallsPerSession,
          avgErrorsPerSession: avgErrorsPerSession,
          avgDuration: avgDuration
        },
        efficiencyScore: efficiencyScore,
        improvements: improvements
      };

    } catch (error) {
      this.log(`Failed to analyze session quality: ${error.message}`, 'error');
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 使用AI生成优化建议
   */
  async getAIOptimizationSuggestions(metrics, recommendations) {
    if (!this.apiKey) {
      return null;
    }

    try {
      const prompt = `分析以下系统性能数据，提供优化建议：

系统指标（最近100次采样）：
- CPU平均: ${this.calculateAverage(metrics.map(m => m.cpu)).toFixed(1)}%
- 内存平均: ${this.calculateAverage(metrics.map(m => m.memory)).toFixed(1)}%
- 磁盘平均: ${this.calculateAverage(metrics.map(m => m.disk)).toFixed(1)}%

已识别的问题：
${recommendations.map(r => `- ${r.issue}`).join('\n')}

请提供：
1. 根本原因分析
2. 具体优化步骤
3. 预期效果

要求：简洁明了，中文回复，不超过200字。`;

      const response = await this.callClaudeAPI(prompt);
      return response;

    } catch (error) {
      this.log(`Failed to get AI optimization suggestions: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * 调用Claude API
   */
  async callClaudeAPI(prompt, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.makeAPIRequest(prompt);
        return result;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await this.sleep(1000 * attempt);
      }
    }
  }

  /**
   * 发送API请求
   */
  async makeAPIRequest(prompt) {
    return new Promise((resolve, reject) => {
      const requestBody = JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const options = {
        hostname: this.hostname,
        port: this.port,
        path: `${this.basePath}/v1/messages`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestBody)
        },
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`API request failed: ${res.statusCode} ${data}`));
              return;
            }

            const response = JSON.parse(data);
            const text = response.content?.[0]?.text || '';
            resolve(text);

          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`API request error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('API request timeout'));
      });

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * 计算平均值
   */
  calculateAverage(data) {
    if (data.length === 0) return 0;
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  /**
   * 计算百分位数
   */
  calculatePercentile(data, percentile) {
    const sorted = [...data].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * 计算趋势（线性回归）
   */
  calculateTrend(dataPoints) {
    if (dataPoints.length < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    const n = dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = dataPoints[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算R²
    const meanY = sumY / n;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      const actual = dataPoints[i].value;
      ssRes += Math.pow(actual - predicted, 2);
      ssTot += Math.pow(actual - meanY, 2);
    }
    const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

    return { slope, intercept, r2 };
  }

  /**
   * 预测未来值
   */
  predictFuture(trend, days) {
    const predictions = [];
    const currentIndex = 0;

    for (let i = 1; i <= days; i++) {
      const predictedValue = trend.slope * (currentIndex + i) + trend.intercept;
      predictions.push({
        day: i,
        value: Math.max(0, Math.min(100, predictedValue))
      });
    }

    return predictions;
  }

  /**
   * 按时间窗口分组
   */
  groupByTimeWindow(data, windowMs) {
    const groups = [];
    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length === 0) return groups;

    let currentWindow = {
      timestamp: sorted[0].timestamp,
      count: 0,
      items: []
    };

    for (const item of sorted) {
      if (item.timestamp - currentWindow.timestamp > windowMs) {
        groups.push(currentWindow);
        currentWindow = {
          timestamp: item.timestamp,
          count: 0,
          items: []
        };
      }
      currentWindow.count++;
      currentWindow.items.push(item);
    }

    groups.push(currentWindow);
    return groups;
  }

  /**
   * 计算效率分数
   */
  calculateEfficiencyScore(metrics) {
    // 基础分数
    let score = 100;

    // 错误率惩罚
    score -= metrics.avgErrors * 10;

    // 工具使用率奖励
    if (metrics.avgToolCalls > 10) {
      score += 10;
    } else if (metrics.avgToolCalls < 5) {
      score -= 10;
    }

    // 会话时长惩罚（过长）
    if (metrics.avgDuration > 2 * 60 * 60 * 1000) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取分析报告
   */
  async getAnalysisReport() {
    return await this.generateAnalysisReport();
  }

  /**
   * 清除历史数据
   */
  clearHistory() {
    this.metricsHistory = {
      system: [],
      sessions: [],
      errors: [],
      performance: []
    };
    this.lastAnalysisReport = null;
    this.lastAnalysisTime = 0;
    this.log('Analytics history cleared');
  }
}

module.exports = AnalyticsEngine;
