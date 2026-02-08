/**
 * AI Summarizer Module - AI智能摘要模块
 * 
 * 使用Claude API分析会话内容，生成智能摘要
 */

const HeartbeatModule = require('../module-interface');
const https = require('https');

class AISummarizer extends HeartbeatModule {
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
  }

  /**
   * 分析会话内容，生成摘要
   */
  async summarizeSession(sessionContent) {
    if (!this.apiKey) {
      this.log('Claude API key not configured, skipping summarization', 'warn');
      return null;
    }

    try {
      // 提取会话的前几条消息和最后几条消息
      const messages = this.extractKeyMessages(sessionContent);
      
      // 构建prompt
      const prompt = `分析以下Claude Code会话内容，用一句话（15字以内）总结用户正在做什么：

${messages}

要求：
1. 只返回摘要，不要其他内容
2. 使用中文
3. 简洁明了，突出重点
4. 例如："开发Telegram监控系统"、"修复登录bug"、"重构数据库模块"`;

      // 调用Claude API
      const summary = await this.callClaudeAPI(prompt);
      
      return summary;
      
    } catch (error) {
      this.log(`Failed to summarize session: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * 提取关键消息
   */
  extractKeyMessages(sessionContent) {
    const lines = sessionContent.split('\n').filter(line => line.trim());

    // 如果内容较短，直接返回
    if (lines.length <= 20) {
      return lines.join('\n');
    }

    // 提取用户消息（通常以"User:"或"用户:"开头）
    const userMessages = lines.filter(line =>
      line.startsWith('User:') ||
      line.startsWith('用户:') ||
      line.includes('问:') ||
      line.includes('要求:')
    );

    // 如果有用户消息，优先使用
    if (userMessages.length > 0) {
      return userMessages.slice(0, 10).join('\n');
    }

    // 否则提取前5条和后5条消息
    const firstMessages = lines.slice(0, 5);
    const lastMessages = lines.slice(-5);

    return [...firstMessages, '...', ...lastMessages].join('\n');
  }

  /**
   * 调用Claude API（带重试和超时）
   */
  async callClaudeAPI(prompt, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.makeAPIRequest(prompt);
        return result;
      } catch (error) {
        this.log(`API call attempt ${attempt} failed: ${error.message}`, 'warn');

        if (attempt === retries) {
          throw error;
        }

        // 指数退避：等待 2^attempt 秒
        const delay = Math.pow(2, attempt) * 1000;
        await this.sleep(delay);
      }
    }
  }

  /**
   * 执行单次API请求
   */
  async makeAPIRequest(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: this.model,
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
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
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 10000 // 10秒超时
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            // 检查HTTP状态码
            if (res.statusCode !== 200) {
              reject(new Error(`API returned status ${res.statusCode}: ${body}`));
              return;
            }

            const response = JSON.parse(body);

            // 验证响应格式
            if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
              reject(new Error('Invalid API response format'));
              return;
            }

            const text = response.content[0].text;
            if (!text || typeof text !== 'string') {
              reject(new Error('Invalid response text'));
              return;
            }

            resolve(text.trim());
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('API request timeout'));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 分析错误，判断优先级
   */
  async analyzeError(errorMessage) {
    if (!this.apiKey) {
      return 'normal';
    }

    try {
      const prompt = `分析以下错误，判断严重程度（critical/high/normal/low）：

${errorMessage}

只返回一个单词：critical、high、normal或low`;

      const priority = await this.callClaudeAPI(prompt);
      const normalized = priority.toLowerCase().trim();

      // 验证返回值
      const validPriorities = ['critical', 'high', 'normal', 'low'];
      if (validPriorities.includes(normalized)) {
        return normalized;
      }

      this.log(`Invalid priority returned: ${priority}, defaulting to normal`, 'warn');
      return 'normal';

    } catch (error) {
      this.log(`Failed to analyze error: ${error.message}`, 'error');
      return 'normal';
    }
  }

  /**
   * 执行模块任务
   * 此模块不需要定时执行，仅提供API供其他模块调用
   */
  async execute() {
    // AI Summarizer不需要定时执行任务
    // 它的功能通过summarizeSession()和analyzeError()方法被其他模块调用
  }
}

module.exports = AISummarizer;
