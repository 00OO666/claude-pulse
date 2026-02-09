/**
 * Session Summary Module - 会话结束总结模块
 *
 * 功能：
 * 1. 监控会话停止（30分钟无活动）
 * 2. 读取会话的最后几条消息
 * 3. 使用AI提取总结性话语
 * 4. 自动发送到Telegram
 */

const HeartbeatModule = require('../module-interface');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

class SessionSummary extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    this.projectsDir = path.join(os.homedir(), '.claude', 'projects');
    this.processedSessions = new Set(); // 已处理的会话ID
    this.inactiveThreshold = 30 * 60 * 1000; // 30分钟

    // Claude API配置
    this.claudeApiKey = config.claudeApiKey || core.config.modules['ai-summarizer']?.claudeApiKey;
    this.claudeBaseUrl = config.baseUrl || core.config.modules['ai-summarizer']?.baseUrl || 'https://api.anthropic.com';
    this.claudeModel = config.model || core.config.modules['ai-summarizer']?.model || 'claude-3-5-sonnet-20241022';
  }

  /**
   * 初始化模块
   */
  async init() {
    this.log('Initializing session summary module...');

    // 监听会话结束事件
    this.core.on('session:end', async (data) => {
      await this.handleSessionEnd(data);
    });

    this.log('Session summary module initialized');
  }

  /**
   * 执行任务
   */
  async execute() {
    try {
      // 扫描所有会话，检查是否有需要总结的
      await this.scanForInactiveSessions();
    } catch (error) {
      this.log(`Failed to execute session summary: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 扫描不活跃的会话
   */
  async scanForInactiveSessions() {
    try {
      if (!fs.existsSync(this.projectsDir)) {
        return;
      }

      const projectDirs = fs.readdirSync(this.projectsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const projectDir of projectDirs) {
        const projectPath = path.join(this.projectsDir, projectDir);
        const sessionFiles = fs.readdirSync(projectPath)
          .filter(file => file.endsWith('.jsonl') && !file.includes('sessions-index'));

        for (const sessionFile of sessionFiles) {
          const sessionId = path.basename(sessionFile, '.jsonl');
          const sessionPath = path.join(projectPath, sessionFile);

          // 跳过已处理的会话
          if (this.processedSessions.has(sessionId)) {
            continue;
          }

          // 检查会话是否不活跃
          const stats = fs.statSync(sessionPath);
          const inactiveTime = Date.now() - stats.mtimeMs;

          if (inactiveTime >= this.inactiveThreshold) {
            // 会话已不活跃，生成总结
            await this.generateSessionSummary(sessionId, sessionPath, projectDir);
            this.processedSessions.add(sessionId);
          }
        }
      }
    } catch (error) {
      this.log(`Failed to scan inactive sessions: ${error.message}`, 'error');
    }
  }

  /**
   * 处理会话结束事件
   */
  async handleSessionEnd(data) {
    const { sessionId, sessionInfo } = data;

    // 跳过已处理的会话
    if (this.processedSessions.has(sessionId)) {
      return;
    }

    try {
      // 生成会话总结
      await this.generateSessionSummary(sessionId, sessionInfo.path, sessionInfo.projectDir);
      this.processedSessions.add(sessionId);
    } catch (error) {
      this.log(`Failed to handle session end: ${error.message}`, 'error');
    }
  }

  /**
   * 生成会话总结
   */
  async generateSessionSummary(sessionId, sessionPath, projectDir) {
    try {
      this.log(`Generating summary for session ${sessionId.substring(0, 8)}...`);

      // 读取会话内容
      const messages = await this.readSessionMessages(sessionPath);

      if (messages.length === 0) {
        this.log('No messages found in session, skipping summary');
        return;
      }

      // 提取最后几条消息（最多20条）
      const recentMessages = messages.slice(-20);

      // 使用AI生成总结
      const summary = await this.generateAISummary(recentMessages);

      // 发送通知
      await this.sendSummaryNotification(sessionId, projectDir, summary, messages.length);

      this.log(`Summary generated for session ${sessionId.substring(0, 8)}`);
    } catch (error) {
      this.log(`Failed to generate session summary: ${error.message}`, 'error');
    }
  }

  /**
   * 读取会话消息
   */
  async readSessionMessages(sessionPath) {
    try {
      const content = fs.readFileSync(sessionPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      const messages = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // 只提取用户和助手的消息
          if (entry.type === 'user' || entry.type === 'assistant') {
            messages.push({
              role: entry.type === 'user' ? 'user' : 'assistant',
              content: this.extractTextContent(entry.data),
              timestamp: entry.timestamp
            });
          }
        } catch (parseError) {
          // 忽略解析错误的行
        }
      }

      return messages;
    } catch (error) {
      this.log(`Failed to read session messages: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * 提取文本内容
   */
  extractTextContent(data) {
    if (!data) return '';

    // 处理不同的数据格式
    if (typeof data === 'string') {
      return data;
    }

    if (data.content) {
      if (typeof data.content === 'string') {
        return data.content;
      }

      if (Array.isArray(data.content)) {
        return data.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n');
      }
    }

    if (data.text) {
      return data.text;
    }

    return JSON.stringify(data).substring(0, 500);
  }

  /**
   * 使用AI生成总结
   */
  async generateAISummary(messages) {
    try {
      // 构建提示词
      const conversationText = messages
        .map(msg => `${msg.role === 'user' ? '用户' : 'Claude'}: ${msg.content}`)
        .join('\n\n');

      const prompt = `请分析以下会话内容，提取出最核心的总结性话语（1-2句话，不超过100字）。
重点关注：
1. 用户的主要需求或问题
2. 完成的主要工作或解决的问题
3. 最终的结果或结论

会话内容：
${conversationText}

请直接输出总结，不要添加任何前缀或解释。`;

      // 调用Claude API
      const summary = await this.callClaudeAPI(prompt);

      return summary.trim();
    } catch (error) {
      this.log(`Failed to generate AI summary: ${error.message}`, 'error');
      return '无法生成总结';
    }
  }

  /**
   * 调用Claude API
   */
  async callClaudeAPI(prompt) {
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
        max_tokens: 200,
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
   * 发送总结通知
   */
  async sendSummaryNotification(sessionId, projectDir, summary, messageCount) {
    let message = `🏁 <b>会话结束</b>\n\n`;
    message += `📂 项目: ${projectDir}\n`;
    message += `💬 消息数: ${messageCount}\n`;
    message += `🆔 会话: ${sessionId.substring(0, 8)}...\n\n`;
    message += `📝 <b>总结</b>:\n${summary}`;

    await this.notify(message);
    this.log('Session summary notification sent');
  }
}

module.exports = SessionSummary;
