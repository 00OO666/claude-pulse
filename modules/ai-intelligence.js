/**
 * AI Intelligence Module - AI智能化增强模块
 *
 * 功能：
 * 1. AI智能摘要升级（多级摘要、关键点提取）
 * 2. AI错误分类和根因分析
 * 3. 活动模式分析
 * 4. 任务识别和追踪
 * 5. 实时摘要（会话进行中每小时生成）
 * 6. 知识图谱构建（会话间的关联）
 */

const HeartbeatModule = require('../module-interface');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

class AIIntelligence extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    this.projectsDir = path.join(os.homedir(), '.claude', 'projects');
    this.knowledgeGraphPath = path.join(os.homedir(), '.claude', 'knowledge-graph.json');
    this.activityPatternsPath = path.join(os.homedir(), '.claude', 'activity-patterns.json');
    this.errorKnowledgePath = path.join(os.homedir(), '.claude', 'error-knowledge.json');

    // Claude API配置
    this.claudeApiKey = config.claudeApiKey || core.config.modules['ai-summarizer']?.claudeApiKey;
    this.claudeBaseUrl = config.baseUrl || core.config.modules['ai-summarizer']?.baseUrl || 'https://api.anthropic.com';
    this.claudeModel = config.model || core.config.modules['ai-summarizer']?.model || 'claude-3-5-sonnet-20241022';

    // 数据存储
    this.knowledgeGraph = this.loadKnowledgeGraph();
    this.activityPatterns = this.loadActivityPatterns();
    this.errorKnowledge = this.loadErrorKnowledge();

    // 实时摘要
    this.lastHourlySummary = Date.now();
    this.hourlySummaryInterval = 60 * 60 * 1000; // 1小时
  }

  /**
   * 初始化模块
   */
  async init() {
    this.log('Initializing AI intelligence module...');

    // 监听错误事件
    this.core.on('error:detected', async (data) => {
      await this.analyzeError(data);
    });

    // 监听会话事件
    this.core.on('session:start', async (data) => {
      await this.analyzeSessionStart(data);
    });

    this.core.on('session:end', async (data) => {
      await this.analyzeSessionEnd(data);
    });

    this.log('AI intelligence module initialized');
  }

  /**
   * 执行任务
   */
  async execute() {
    try {
      // 生成实时摘要
      await this.generateHourlySummary();

      // 分析活动模式
      await this.analyzeActivityPatterns();

      // 更新知识图谱
      await this.updateKnowledgeGraph();
    } catch (error) {
      this.log(`Failed to execute AI intelligence: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 生成每小时摘要
   */
  async generateHourlySummary() {
    const now = Date.now();
    if (now - this.lastHourlySummary < this.hourlySummaryInterval) {
      return;
    }

    try {
      this.log('Generating hourly summary...');

      // 获取最近1小时的活动
      const recentActivity = await this.getRecentActivity(60 * 60 * 1000);

      if (recentActivity.length === 0) {
        return;
      }

      // 生成多级摘要
      const summaries = await this.generateMultiLevelSummary(recentActivity);

      // 提取关键点
      const keyPoints = await this.extractKeyPoints(recentActivity);

      // 发送通知
      await this.sendHourlySummaryNotification(summaries, keyPoints);

      this.lastHourlySummary = now;
    } catch (error) {
      this.log(`Failed to generate hourly summary: ${error.message}`, 'error');
    }
  }

  /**
   * 生成多级摘要
   */
  async generateMultiLevelSummary(activity) {
    try {
      const activityText = this.formatActivityForAI(activity);

      // 简短摘要（15字）
      const shortPrompt = `请用15字以内总结以下活动的核心内容：\n\n${activityText}\n\n只输出摘要，不要解释。`;
      const shortSummary = await this.callClaudeAPI(shortPrompt, 50);

      // 中等摘要（50字）
      const mediumPrompt = `请用50字左右总结以下活动的主要内容：\n\n${activityText}\n\n只输出摘要，不要解释。`;
      const mediumSummary = await this.callClaudeAPI(mediumPrompt, 100);

      // 详细摘要（200字）
      const detailedPrompt = `请详细总结以下活动（200字左右），包括：
1. 主要工作内容
2. 遇到的问题
3. 解决方案
4. 当前进度

活动内容：
${activityText}

只输出摘要，不要添加标题。`;
      const detailedSummary = await this.callClaudeAPI(detailedPrompt, 500);

      return {
        short: shortSummary.trim(),
        medium: mediumSummary.trim(),
        detailed: detailedSummary.trim()
      };
    } catch (error) {
      this.log(`Failed to generate multi-level summary: ${error.message}`, 'error');
      return {
        short: '摘要生成失败',
        medium: '摘要生成失败',
        detailed: '摘要生成失败'
      };
    }
  }

  /**
   * 提取关键点
   */
  async extractKeyPoints(activity) {
    try {
      const activityText = this.formatActivityForAI(activity);

      const prompt = `请从以下活动中提取3-5个关键点，每个关键点用一句话描述：

${activityText}

格式：
- 关键点1
- 关键点2
- 关键点3

只输出关键点列表，不要添加其他内容。`;

      const keyPointsText = await this.callClaudeAPI(prompt, 300);

      // 解析关键点
      const keyPoints = keyPointsText
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .filter(point => point.length > 0);

      return keyPoints;
    } catch (error) {
      this.log(`Failed to extract key points: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * 分析错误
   */
  async analyzeError(errorData) {
    try {
      this.log('Analyzing error with AI...');

      const { error, context } = errorData;

      // 使用AI分析错误
      const analysis = await this.performErrorAnalysis(error, context);

      // 保存到错误知识库
      this.saveErrorKnowledge(error, analysis);

      // 发送分析通知
      await this.sendErrorAnalysisNotification(error, analysis);

      this.log('Error analysis completed');
    } catch (error) {
      this.log(`Failed to analyze error: ${error.message}`, 'error');
    }
  }

  /**
   * 执行错误分析
   */
  async performErrorAnalysis(error, context) {
    try {
      const prompt = `请分析以下错误，提供：
1. 错误类型（语法/逻辑/网络/配置/依赖/其他）
2. 根本原因（为什么会出错）
3. 修复建议（如何修复）
4. 预防措施（如何避免再次发生）

错误信息：
${error}

上下文：
${context || '无'}

请用JSON格式输出：
{
  "type": "错误类型",
  "rootCause": "根本原因",
  "fixSuggestion": "修复建议",
  "prevention": "预防措施"
}`;

      const response = await this.callClaudeAPI(prompt, 800);

      // 尝试解析JSON
      try {
        return JSON.parse(response);
      } catch (parseError) {
        // 如果解析失败，返回原始文本
        return {
          type: '未知',
          rootCause: response,
          fixSuggestion: '请查看详细分析',
          prevention: '暂无'
        };
      }
    } catch (error) {
      this.log(`Failed to perform error analysis: ${error.message}`, 'error');
      return {
        type: '分析失败',
        rootCause: error.message,
        fixSuggestion: '无法生成建议',
        prevention: '无法生成预防措施'
      };
    }
  }

  /**
   * 分析活动模式
   */
  async analyzeActivityPatterns() {
    try {
      // 获取最近7天的活动数据
      const weekActivity = await this.getRecentActivity(7 * 24 * 60 * 60 * 1000);

      if (weekActivity.length === 0) {
        return;
      }

      // 分析工作时段
      const workHours = this.analyzeWorkHours(weekActivity);

      // 分析生产力
      const productivity = this.analyzeProductivity(weekActivity);

      // 更新活动模式
      this.activityPatterns = {
        ...this.activityPatterns,
        workHours,
        productivity,
        lastUpdated: new Date().toISOString()
      };

      this.saveActivityPatterns();

      this.log('Activity patterns analyzed');
    } catch (error) {
      this.log(`Failed to analyze activity patterns: ${error.message}`, 'error');
    }
  }

  /**
   * 分析工作时段
   */
  analyzeWorkHours(activity) {
    const hourCounts = new Array(24).fill(0);

    for (const item of activity) {
      if (item.timestamp) {
        const hour = new Date(item.timestamp).getHours();
        hourCounts[hour]++;
      }
    }

    // 找出高峰时段（活动量最高的3个小时）
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour)
      .sort((a, b) => a - b);

    return {
      peakHours,
      distribution: hourCounts
    };
  }

  /**
   * 分析生产力
   */
  analyzeProductivity(activity) {
    // 计算各种指标
    const totalMessages = activity.filter(item => item.type === 'message').length;
    const totalToolCalls = activity.filter(item => item.type === 'tool_call').length;
    const totalErrors = activity.filter(item => item.type === 'error').length;

    // 生产力评分（0-100）
    const score = Math.min(100, Math.max(0,
      (totalMessages * 2 + totalToolCalls * 3 - totalErrors * 5) / 10
    ));

    return {
      score: Math.round(score),
      totalMessages,
      totalToolCalls,
      totalErrors,
      errorRate: totalMessages > 0 ? (totalErrors / totalMessages * 100).toFixed(2) : 0
    };
  }

  /**
   * 更新知识图谱
   */
  async updateKnowledgeGraph() {
    try {
      // 获取最近的会话
      const recentSessions = await this.getRecentSessions();

      // 提取主题和关联
      for (const session of recentSessions) {
        const topics = await this.extractTopics(session);
        const relations = await this.findRelations(session, topics);

        // 更新图谱
        this.addToKnowledgeGraph(session.id, topics, relations);
      }

      this.saveKnowledgeGraph();

      this.log('Knowledge graph updated');
    } catch (error) {
      this.log(`Failed to update knowledge graph: ${error.message}`, 'error');
    }
  }

  /**
   * 提取主题
   */
  async extractTopics(session) {
    try {
      const sessionText = this.formatSessionForAI(session);

      const prompt = `请从以下会话中提取主要主题（3-5个关键词）：

${sessionText}

只输出关键词，用逗号分隔，不要解释。`;

      const response = await this.callClaudeAPI(prompt, 100);

      return response.split(',').map(topic => topic.trim()).filter(topic => topic.length > 0);
    } catch (error) {
      this.log(`Failed to extract topics: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * 查找关联
   */
  async findRelations(session, topics) {
    const relations = [];

    // 在知识图谱中查找相关的会话
    for (const [sessionId, data] of Object.entries(this.knowledgeGraph)) {
      if (sessionId === session.id) continue;

      // 计算主题重叠度
      const overlap = topics.filter(topic =>
        data.topics && data.topics.includes(topic)
      ).length;

      if (overlap > 0) {
        relations.push({
          sessionId,
          overlap,
          topics: data.topics
        });
      }
    }

    return relations;
  }

  /**
   * 添加到知识图谱
   */
  addToKnowledgeGraph(sessionId, topics, relations) {
    this.knowledgeGraph[sessionId] = {
      topics,
      relations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 分析会话开始
   */
  async analyzeSessionStart(data) {
    try {
      const { sessionInfo } = data;

      // 识别任务类型
      const taskType = await this.identifyTaskType(sessionInfo);

      this.log(`Task type identified: ${taskType}`);

      // 触发事件
      this.emit('task:identified', { sessionInfo, taskType });
    } catch (error) {
      this.log(`Failed to analyze session start: ${error.message}`, 'error');
    }
  }

  /**
   * 分析会话结束
   */
  async analyzeSessionEnd(data) {
    try {
      const { sessionInfo } = data;

      // 评估任务完成度
      const completion = await this.evaluateTaskCompletion(sessionInfo);

      this.log(`Task completion: ${completion}%`);

      // 触发事件
      this.emit('task:completed', { sessionInfo, completion });
    } catch (error) {
      this.log(`Failed to analyze session end: ${error.message}`, 'error');
    }
  }

  /**
   * 识别任务类型
   */
  async identifyTaskType(sessionInfo) {
    // 基于简单规则识别
    const cwd = sessionInfo.cwd || '';

    if (cwd.includes('test')) return '测试';
    if (cwd.includes('doc')) return '文档';
    if (cwd.includes('debug')) return '调试';

    return '开发';
  }

  /**
   * 评估任务完成度
   */
  async evaluateTaskCompletion(sessionInfo) {
    // 基于简单指标评估
    const { messageCount, toolCalls, errors } = sessionInfo;

    // 完成度评分（0-100）
    const score = Math.min(100, Math.max(0,
      (messageCount * 2 + toolCalls * 3 - errors * 10)
    ));

    return Math.round(score);
  }

  /**
   * 获取最近活动
   */
  async getRecentActivity(timeRange) {
    // 这里简化实现，实际应该从会话文件中读取
    return [];
  }

  /**
   * 获取最近会话
   */
  async getRecentSessions() {
    // 这里简化实现，实际应该从会话文件中读取
    return [];
  }

  /**
   * 格式化活动为AI输入
   */
  formatActivityForAI(activity) {
    return activity
      .map(item => `[${item.timestamp}] ${item.type}: ${item.content || ''}`)
      .join('\n')
      .substring(0, 3000); // 限制长度
  }

  /**
   * 格式化会话为AI输入
   */
  formatSessionForAI(session) {
    return JSON.stringify(session).substring(0, 3000);
  }

  /**
   * 调用Claude API
   */
  async callClaudeAPI(prompt, maxTokens = 500) {
    return new Promise((resolve, reject) => {
      // 解析baseUrl，确保正确处理路径
      let apiUrl;
      try {
        // 如果baseUrl已经包含完整路径，直接使用
        if (this.claudeBaseUrl.includes('/v1/messages')) {
          apiUrl = new URL(this.claudeBaseUrl);
        } else {
          // 否则添加/v1/messages路径
          apiUrl = new URL(this.claudeBaseUrl);
          apiUrl.pathname = apiUrl.pathname.replace(/\/$/, '') + '/v1/messages';
        }
      } catch (error) {
        reject(new Error(`Invalid API URL: ${error.message}`));
        return;
      }

      const requestData = JSON.stringify({
        model: this.claudeModel,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const options = {
        hostname: apiUrl.hostname,
        port: apiUrl.port || 443,
        path: apiUrl.pathname + (apiUrl.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          // 检查HTTP状态码
          if (res.statusCode !== 200) {
            reject(new Error(`API request failed with status ${res.statusCode}: ${data.substring(0, 200)}`));
            return;
          }

          try {
            const response = JSON.parse(data);

            if (response.content && response.content[0] && response.content[0].text) {
              resolve(response.content[0].text);
            } else if (response.error) {
              reject(new Error(`API error: ${response.error.message || JSON.stringify(response.error)}`));
            } else {
              reject(new Error('Invalid API response format'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}. Response: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`API request failed: ${error.message}`));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * 发送每小时摘要通知
   */
  async sendHourlySummaryNotification(summaries, keyPoints) {
    let message = `📊 <b>实时摘要</b>\n\n`;
    message += `⏰ 时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    message += `📝 <b>简短摘要</b>: ${summaries.short}\n\n`;
    message += `📄 <b>中等摘要</b>:\n${summaries.medium}\n\n`;

    if (keyPoints.length > 0) {
      message += `🔑 <b>关键点</b>:\n`;
      keyPoints.forEach((point, index) => {
        message += `${index + 1}. ${point}\n`;
      });
      message += `\n`;
    }

    message += `📖 <b>详细摘要</b>:\n${summaries.detailed}`;

    await this.notify(message);
    this.log('Hourly summary notification sent');
  }

  /**
   * 发送错误分析通知
   */
  async sendErrorAnalysisNotification(error, analysis) {
    let message = `🔍 <b>错误分析</b>\n\n`;
    message += `⚠️ <b>错误类型</b>: ${analysis.type}\n\n`;
    message += `🔎 <b>根本原因</b>:\n${analysis.rootCause}\n\n`;
    message += `💡 <b>修复建议</b>:\n${analysis.fixSuggestion}\n\n`;
    message += `🛡️ <b>预防措施</b>:\n${analysis.prevention}`;

    await this.notify(message);
    this.log('Error analysis notification sent');
  }

  /**
   * 加载知识图谱
   */
  loadKnowledgeGraph() {
    try {
      if (fs.existsSync(this.knowledgeGraphPath)) {
        const data = fs.readFileSync(this.knowledgeGraphPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.log(`Failed to load knowledge graph: ${error.message}`, 'error');
    }
    return {};
  }

  /**
   * 保存知识图谱
   */
  saveKnowledgeGraph() {
    try {
      fs.writeFileSync(
        this.knowledgeGraphPath,
        JSON.stringify(this.knowledgeGraph, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.log(`Failed to save knowledge graph: ${error.message}`, 'error');
    }
  }

  /**
   * 加载活动模式
   */
  loadActivityPatterns() {
    try {
      if (fs.existsSync(this.activityPatternsPath)) {
        const data = fs.readFileSync(this.activityPatternsPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.log(`Failed to load activity patterns: ${error.message}`, 'error');
    }
    return {};
  }

  /**
   * 保存活动模式
   */
  saveActivityPatterns() {
    try {
      fs.writeFileSync(
        this.activityPatternsPath,
        JSON.stringify(this.activityPatterns, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.log(`Failed to save activity patterns: ${error.message}`, 'error');
    }
  }

  /**
   * 加载错误知识库
   */
  loadErrorKnowledge() {
    try {
      if (fs.existsSync(this.errorKnowledgePath)) {
        const data = fs.readFileSync(this.errorKnowledgePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.log(`Failed to load error knowledge: ${error.message}`, 'error');
    }
    return {};
  }

  /**
   * 保存错误知识
   */
  saveErrorKnowledge(error, analysis) {
    try {
      const errorKey = this.generateErrorKey(error);

      this.errorKnowledge[errorKey] = {
        error,
        analysis,
        timestamp: new Date().toISOString(),
        count: (this.errorKnowledge[errorKey]?.count || 0) + 1
      };

      fs.writeFileSync(
        this.errorKnowledgePath,
        JSON.stringify(this.errorKnowledge, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.log(`Failed to save error knowledge: ${error.message}`, 'error');
    }
  }

  /**
   * 生成错误键
   */
  generateErrorKey(error) {
    // 简化错误信息作为键
    return error.substring(0, 100).replace(/[^a-zA-Z0-9]/g, '_');
  }
}

module.exports = AIIntelligence;
