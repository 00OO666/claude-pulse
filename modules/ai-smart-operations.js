/**
 * AI Smart Operations Module - AI 智能操作模块
 *
 * 功能：
 * 1. 结合 OCR 和 Claude API 理解屏幕内容
 * 2. 根据屏幕状态自动决策和执行操作
 * 3. 智能识别按钮、输入框等 UI 元素
 * 4. 自动化复杂操作流程
 * 5. 学习用户操作模式
 */

const HeartbeatModule = require('../module-interface');
const https = require('https');

class AISmartOperations extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 配置
    this.claudeApiKey = config.claudeApiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.maxTokens = config.maxTokens || 1024;

    // 操作历史
    this.operationHistory = [];
    this.maxHistorySize = config.maxHistorySize || 50;

    // 学习的模式
    this.learnedPatterns = [];

    // 统计
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageConfidence: 0
    };
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();

    // 检查依赖模块
    if (!this.core.modules.has('ocr-recognizer')) {
      throw new Error('OCR Recognizer module is required');
    }
    if (!this.core.modules.has('keyboard-controller')) {
      throw new Error('Keyboard Controller module is required');
    }

    this.log('info', 'AI Smart Operations initialized');
  }

  /**
   * 分析屏幕并执行操作
   * @param {Object} options - 选项
   * @param {string} options.goal - 目标描述
   * @param {Object} options.region - 屏幕区域
   * @param {boolean} options.dryRun - 是否只分析不执行
   * @returns {Promise<Object>} 操作结果
   */
  async analyzeAndOperate(options = {}) {
    this.stats.totalOperations++;
    const startTime = Date.now();

    try {
      // 1. 截图
      const screenshot = await this.captureScreen(options.region);

      // 2. OCR 识别
      const ocrResult = await this.recognizeScreen(options.region);

      // 3. AI 分析
      const analysis = await this.analyzeWithAI({
        goal: options.goal,
        ocrText: ocrResult.text,
        ocrWords: ocrResult.words,
        screenshot: screenshot
      });

      // 4. 执行操作（如果不是 dry run）
      let executionResult = null;
      if (!options.dryRun && analysis.actions && analysis.actions.length > 0) {
        executionResult = await this.executeActions(analysis.actions);
      }

      // 5. 记录操作
      const operation = {
        timestamp: Date.now(),
        goal: options.goal,
        analysis,
        executionResult,
        duration: Date.now() - startTime,
        success: executionResult ? executionResult.success : null
      };

      this.recordOperation(operation);

      // 6. 更新统计
      if (executionResult && executionResult.success) {
        this.stats.successfulOperations++;
      } else if (executionResult) {
        this.stats.failedOperations++;
      }

      this.emit('ai:operation-completed', operation);

      return operation;
    } catch (error) {
      this.stats.failedOperations++;
      this.log('error', `AI operation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 截取屏幕
   */
  async captureScreen(region = {}) {
    const keyboardController = this.core.modules.get('keyboard-controller');
    return await keyboardController.captureScreen(
      region.x || 0,
      region.y || 0,
      region.width || 1920,
      region.height || 1080
    );
  }

  /**
   * 识别屏幕文字
   */
  async recognizeScreen(region = {}) {
    const ocrRecognizer = this.core.modules.get('ocr-recognizer');
    return await ocrRecognizer.recognizeRegion(region);
  }

  /**
   * 使用 AI 分析屏幕内容
   */
  async analyzeWithAI(context) {
    const prompt = this.buildAnalysisPrompt(context);

    const response = await this.callClaudeAPI({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // 解析 AI 响应
    return this.parseAIResponse(response);
  }

  /**
   * 构建分析提示词
   */
  buildAnalysisPrompt(context) {
    let prompt = `你是一个屏幕操作助手。用户的目标是：${context.goal}\n\n`;
    prompt += `屏幕上识别到的文字：\n${context.ocrText}\n\n`;

    if (context.ocrWords && context.ocrWords.length > 0) {
      prompt += `文字位置信息：\n`;
      for (const word of context.ocrWords.slice(0, 20)) { // 只显示前20个
        prompt += `- "${word.text}" at (${word.bbox.left}, ${word.bbox.top})\n`;
      }
      prompt += `\n`;
    }

    prompt += `请分析屏幕内容，并提供以下信息：\n`;
    prompt += `1. 屏幕当前状态的描述\n`;
    prompt += `2. 为了达成目标，需要执行的操作步骤\n`;
    prompt += `3. 每个操作的具体参数（例如点击位置、输入文字等）\n`;
    prompt += `4. 操作的置信度（0-100）\n\n`;
    prompt += `请以 JSON 格式返回，格式如下：\n`;
    prompt += `{\n`;
    prompt += `  "description": "屏幕状态描述",\n`;
    prompt += `  "confidence": 85,\n`;
    prompt += `  "actions": [\n`;
    prompt += `    {\n`;
    prompt += `      "type": "click|type|key|wait",\n`;
    prompt += `      "target": "目标描述",\n`;
    prompt += `      "position": { "x": 100, "y": 200 },\n`;
    prompt += `      "text": "要输入的文字（如果是 type）",\n`;
    prompt += `      "key": "按键名称（如果是 key）",\n`;
    prompt += `      "duration": 1000\n`;
    prompt += `    }\n`;
    prompt += `  ]\n`;
    prompt += `}`;

    return prompt;
  }

  /**
   * 调用 Claude API
   */
  async callClaudeAPI(payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);

      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response);
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 解析 AI 响应
   */
  parseAIResponse(response) {
    try {
      // 提取 JSON 内容
      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证必需字段
      if (!parsed.description || !parsed.confidence) {
        throw new Error('Invalid AI response format');
      }

      return parsed;
    } catch (error) {
      this.log('error', `Failed to parse AI response: ${error.message}`);
      throw error;
    }
  }

  /**
   * 执行操作序列
   */
  async executeActions(actions) {
    const keyboardController = this.core.modules.get('keyboard-controller');
    const results = [];

    for (const action of actions) {
      try {
        let result;

        switch (action.type) {
          case 'click':
            if (action.position) {
              await keyboardController.moveMouse(action.position.x, action.position.y);
              await keyboardController.clickMouse('left');
              result = { success: true, action: 'click', position: action.position };
            }
            break;

          case 'type':
            if (action.text) {
              await keyboardController.typeString(action.text);
              result = { success: true, action: 'type', text: action.text };
            }
            break;

          case 'key':
            if (action.key) {
              await keyboardController.keyTap(action.key);
              result = { success: true, action: 'key', key: action.key };
            }
            break;

          case 'wait':
            await this.sleep(action.duration || 1000);
            result = { success: true, action: 'wait', duration: action.duration };
            break;

          default:
            result = { success: false, error: `Unknown action type: ${action.type}` };
        }

        results.push(result);
        this.log('debug', `Executed action: ${JSON.stringify(result)}`);
      } catch (error) {
        results.push({ success: false, error: error.message, action });
        this.log('error', `Action execution failed: ${error.message}`);
      }
    }

    return {
      success: results.every(r => r.success),
      results
    };
  }

  /**
   * 查找并点击文字
   * @param {string} text - 要查找的文字
   * @param {Object} region - 搜索区域
   * @returns {Promise<boolean>} 是否成功
   */
  async findAndClick(text, region = {}) {
    const ocrRecognizer = this.core.modules.get('ocr-recognizer');
    const keyboardController = this.core.modules.get('keyboard-controller');

    // 查找文字
    const matches = await ocrRecognizer.findText(text, region);

    if (matches.length === 0) {
      this.log('warn', `Text not found: ${text}`);
      return false;
    }

    // 点击第一个匹配
    const match = matches[0];
    await keyboardController.moveMouse(match.position.x, match.position.y);
    await keyboardController.clickMouse('left');

    this.log('info', `Clicked on text: ${text} at (${match.position.x}, ${match.position.y})`);
    return true;
  }

  /**
   * 智能填写表单
   * @param {Object} formData - 表单数据
   * @param {Object} region - 表单区域
   * @returns {Promise<boolean>} 是否成功
   */
  async smartFillForm(formData, region = {}) {
    // 使用 AI 分析表单并填写
    const goal = `填写表单，数据：${JSON.stringify(formData)}`;
    const result = await this.analyzeAndOperate({ goal, region });

    return result.executionResult && result.executionResult.success;
  }

  /**
   * 记录操作
   */
  recordOperation(operation) {
    this.operationHistory.push(operation);

    // 保持历史大小
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.shift();
    }

    // 学习模式
    if (operation.success) {
      this.learnPattern(operation);
    }
  }

  /**
   * 学习操作模式
   */
  learnPattern(operation) {
    // 简单的模式学习：记录成功的操作
    const pattern = {
      goal: operation.goal,
      actions: operation.analysis.actions,
      confidence: operation.analysis.confidence,
      timestamp: operation.timestamp
    };

    this.learnedPatterns.push(pattern);

    // 保持模式数量
    if (this.learnedPatterns.length > 20) {
      this.learnedPatterns.shift();
    }
  }

  /**
   * 查找相似的学习模式
   */
  findSimilarPattern(goal) {
    for (const pattern of this.learnedPatterns) {
      if (pattern.goal.toLowerCase().includes(goal.toLowerCase()) ||
          goal.toLowerCase().includes(pattern.goal.toLowerCase())) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * 睡眠
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      operationHistorySize: this.operationHistory.length,
      learnedPatternsCount: this.learnedPatterns.length
    };
  }

  /**
   * 清理模块
   */
  async cleanup() {
    this.operationHistory = [];
    this.learnedPatterns = [];
    await super.cleanup();
  }
}

module.exports = AISmartOperations;