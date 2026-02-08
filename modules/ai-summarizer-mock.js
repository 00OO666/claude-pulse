/**
 * AI Summarizer 模拟版本（用于测试）
 *
 * 当无法连接真实API时，使用规则引擎模拟AI分析
 */

const HeartbeatModule = require('../module-interface');

class AISummarizerMock extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);
  }

  /**
   * 分析会话内容，生成摘要（模拟版本）
   */
  async summarizeSession(sessionContent) {
    try {
      // 提取关键词
      const keywords = this.extractKeywords(sessionContent);

      // 生成摘要
      if (keywords.length === 0) {
        return '日常对话';
      }

      // 根据关键词生成摘要
      const summary = this.generateSummary(keywords);

      this.log(`Generated summary: ${summary}`, 'info');
      return summary;

    } catch (error) {
      this.log(`Failed to summarize session: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * 提取关键词
   */
  extractKeywords(content) {
    const keywords = [];

    // 技术关键词
    const techKeywords = [
      'Telegram', 'bot', 'API', '监控', '系统', '开发', '部署',
      '数据库', '服务器', '网站', '前端', '后端', '测试',
      'bug', '错误', '修复', '优化', '重构', '升级'
    ];

    for (const keyword of techKeywords) {
      if (content.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  /**
   * 生成摘要
   */
  generateSummary(keywords) {
    // 根据关键词组合生成摘要
    if (keywords.includes('Telegram') && keywords.includes('bot')) {
      return '开发Telegram机器人';
    }

    if (keywords.includes('监控') && keywords.includes('系统')) {
      return '开发监控系统';
    }

    if (keywords.includes('bug') || keywords.includes('错误') || keywords.includes('修复')) {
      return '修复程序错误';
    }

    if (keywords.includes('开发')) {
      return `开发${keywords[0]}功能`;
    }

    if (keywords.includes('部署')) {
      return `部署${keywords[0]}服务`;
    }

    if (keywords.includes('优化') || keywords.includes('重构')) {
      return `优化${keywords[0]}模块`;
    }

    // 默认摘要
    return keywords.slice(0, 2).join('') + '相关工作';
  }

  /**
   * 分析错误，判断优先级（模拟版本）
   */
  async analyzeError(errorMessage) {
    try {
      const message = errorMessage.toLowerCase();

      // Critical: 致命错误
      if (message.includes('fatal') ||
          message.includes('crash') ||
          message.includes('corrupted') ||
          message.includes('data loss')) {
        return 'critical';
      }

      // High: 严重错误
      if (message.includes('error') ||
          message.includes('exception') ||
          message.includes('failed') ||
          message.includes('timeout')) {
        return 'high';
      }

      // Low: 警告
      if (message.includes('warning') ||
          message.includes('deprecated')) {
        return 'low';
      }

      // Normal: 普通错误
      return 'normal';

    } catch (error) {
      this.log(`Failed to analyze error: ${error.message}`, 'error');
      return 'normal';
    }
  }

  /**
   * 执行模块任务
   */
  async execute() {
    // Mock版本不需要定时执行
  }
}

module.exports = AISummarizerMock;
