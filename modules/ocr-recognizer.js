/**
 * OCR Recognizer Module - OCR 屏幕识别模块
 *
 * 功能：
 * 1. 屏幕截图和文字识别
 * 2. 支持中英文 OCR
 * 3. 区域识别（指定屏幕区域）
 * 4. 返回识别结果和坐标
 * 5. 缓存识别结果
 */

const HeartbeatModule = require('../module-interface');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class OCRRecognizer extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 配置
    this.tempDir = path.join(os.tmpdir(), 'claude-pulse-ocr');
    this.cacheEnabled = config.cacheEnabled !== false;
    this.cacheTimeout = config.cacheTimeout || 60000; // 1分钟
    this.languages = config.languages || ['eng', 'chi_sim']; // 英文和简体中文

    // OCR 引擎选择
    this.ocrEngine = config.ocrEngine || 'auto'; // auto, tesseract, windows
    this.tesseractPath = config.tesseractPath || 'tesseract';

    // 缓存
    this.cache = new Map();

    // 统计
    this.stats = {
      totalRecognitions: 0,
      cacheHits: 0,
      averageTime: 0,
      errors: 0
    };

    // 确保临时目录存在
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();

    // 检测可用的 OCR 引擎
    await this.detectOCREngine();

    this.log('info', `OCR Recognizer initialized with engine: ${this.ocrEngine}`);
  }

  /**
   * 检测可用的 OCR 引擎
   */
  async detectOCREngine() {
    if (this.ocrEngine !== 'auto') {
      return;
    }

    // 尝试检测 Tesseract
    try {
      await this.execCommand(`${this.tesseractPath} --version`);
      this.ocrEngine = 'tesseract';
      this.log('info', 'Detected Tesseract OCR engine');
      return;
    } catch (error) {
      // Tesseract 不可用
    }

    // Windows 平台尝试使用 Windows OCR
    if (os.platform() === 'win32') {
      this.ocrEngine = 'windows';
      this.log('info', 'Using Windows OCR engine');
      return;
    }

    // 没有可用的 OCR 引擎
    this.ocrEngine = 'none';
    this.log('warn', 'No OCR engine available');
  }

  /**
   * 识别屏幕区域的文字
   * @param {Object} options - 识别选项
   * @param {number} options.x - X 坐标
   * @param {number} options.y - Y 坐标
   * @param {number} options.width - 宽度
   * @param {number} options.height - 高度
   * @param {string} options.language - 语言（eng, chi_sim, chi_tra）
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeRegion(options = {}) {
    const startTime = Date.now();
    this.stats.totalRecognitions++;

    try {
      // 检查缓存
      const cacheKey = this.getCacheKey(options);
      if (this.cacheEnabled && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          this.stats.cacheHits++;
          this.log('debug', 'OCR cache hit');
          return cached.result;
        }
      }

      // 截图
      const screenshotPath = await this.captureScreenshot(options);

      // OCR 识别
      let result;
      if (this.ocrEngine === 'tesseract') {
        result = await this.recognizeWithTesseract(screenshotPath, options.language);
      } else if (this.ocrEngine === 'windows') {
        result = await this.recognizeWithWindows(screenshotPath);
      } else {
        throw new Error('No OCR engine available');
      }

      // 清理临时文件
      try {
        fs.unlinkSync(screenshotPath);
      } catch (error) {
        // 忽略清理错误
      }

      // 更新统计
      const duration = Date.now() - startTime;
      this.stats.averageTime = (this.stats.averageTime * (this.stats.totalRecognitions - 1) + duration) / this.stats.totalRecognitions;

      // 缓存结果
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }

      this.emit('ocr:recognized', { options, result, duration });

      return result;
    } catch (error) {
      this.stats.errors++;
      this.log('error', `OCR recognition failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 截取屏幕区域
   */
  async captureScreenshot(options = {}) {
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(this.tempDir, filename);

    // 使用 keyboard-controller 的截图功能
    if (this.core.modules.has('keyboard-controller')) {
      const keyboardController = this.core.modules.get('keyboard-controller');
      const screenshot = await keyboardController.captureScreen(
        options.x || 0,
        options.y || 0,
        options.width || 1920,
        options.height || 1080
      );

      // 保存截图
      if (screenshot && screenshot.image) {
        fs.writeFileSync(filepath, screenshot.image);
        return filepath;
      }
    }

    // 备用方案：使用 PowerShell 截图（Windows）
    if (os.platform() === 'win32') {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap ${options.width || '$screen.Width'}, ${options.height || '$screen.Height'}
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen(${options.x || 0}, ${options.y || 0}, 0, 0, $bitmap.Size)
        $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}')
        $graphics.Dispose()
        $bitmap.Dispose()
      `;

      await this.execCommand(`pwsh -Command "${psScript}"`);
      return filepath;
    }

    throw new Error('Screenshot capture not available');
  }

  /**
   * 使用 Tesseract 识别
   */
  async recognizeWithTesseract(imagePath, language = 'eng') {
    const outputBase = path.join(this.tempDir, `ocr_${Date.now()}`);
    const lang = language || this.languages.join('+');

    // 执行 Tesseract
    const command = `${this.tesseractPath} "${imagePath}" "${outputBase}" -l ${lang} --psm 6 tsv`;
    const output = await this.execCommand(command);

    // 读取 TSV 结果
    const tsvPath = `${outputBase}.tsv`;
    if (!fs.existsSync(tsvPath)) {
      throw new Error('Tesseract output not found');
    }

    const tsvContent = fs.readFileSync(tsvPath, 'utf-8');
    const result = this.parseTesseractTSV(tsvContent);

    // 清理临时文件
    try {
      fs.unlinkSync(tsvPath);
    } catch (error) {
      // 忽略
    }

    return result;
  }

  /**
   * 解析 Tesseract TSV 输出
   */
  parseTesseractTSV(tsvContent) {
    const lines = tsvContent.split('\n').slice(1); // 跳过标题行
    const words = [];
    let fullText = '';

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split('\t');
      if (parts.length < 12) continue;

      const level = parseInt(parts[0]);
      const text = parts[11].trim();
      const conf = parseFloat(parts[10]);

      if (level === 5 && text && conf > 0) { // 单词级别
        words.push({
          text,
          confidence: conf,
          bbox: {
            left: parseInt(parts[6]),
            top: parseInt(parts[7]),
            width: parseInt(parts[8]),
            height: parseInt(parts[9])
          }
        });
        fullText += text + ' ';
      }
    }

    return {
      text: fullText.trim(),
      words,
      confidence: words.length > 0 ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length : 0
    };
  }

  /**
   * 使用 Windows OCR 识别
   */
  async recognizeWithWindows(imagePath) {
    // Windows 10/11 内置 OCR API
    const psScript = `
      Add-Type -AssemblyName System.Runtime.WindowsRuntime
      $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
      $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
      $null = [Windows.Foundation.IAsyncOperation\`1, Windows.Foundation, ContentType = WindowsRuntime]
      $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]

      $file = [Windows.Storage.StorageFile]::GetFileFromPathAsync('${imagePath.replace(/\\/g, '\\\\')}')
      $file = $file.GetResults()

      $stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
      $stream = $stream.GetResults()

      $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
      $decoder = $decoder.GetResults()

      $bitmap = $decoder.GetSoftwareBitmapAsync()
      $bitmap = $bitmap.GetResults()

      $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
      $result = $engine.RecognizeAsync($bitmap)
      $result = $result.GetResults()

      $result.Text
    `;

    try {
      const output = await this.execCommand(`pwsh -Command "${psScript}"`);
      return {
        text: output.trim(),
        words: [],
        confidence: 90 // Windows OCR 不提供置信度
      };
    } catch (error) {
      throw new Error(`Windows OCR failed: ${error.message}`);
    }
  }

  /**
   * 查找屏幕上的文字
   * @param {string} searchText - 要查找的文字
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 匹配的位置列表
   */
  async findText(searchText, options = {}) {
    const result = await this.recognizeRegion(options);

    const matches = [];
    for (const word of result.words) {
      if (word.text.toLowerCase().includes(searchText.toLowerCase())) {
        matches.push({
          text: word.text,
          position: {
            x: word.bbox.left + word.bbox.width / 2,
            y: word.bbox.top + word.bbox.height / 2
          },
          bbox: word.bbox,
          confidence: word.confidence
        });
      }
    }

    return matches;
  }

  /**
   * 获取缓存键
   */
  getCacheKey(options) {
    return `${options.x || 0}_${options.y || 0}_${options.width || 0}_${options.height || 0}_${options.language || 'eng'}`;
  }

  /**
   * 执行命令
   */
  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.clear();
    this.log('info', 'OCR cache cleared');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      engine: this.ocrEngine
    };
  }

  /**
   * 清理模块
   */
  async cleanup() {
    this.clearCache();

    // 清理临时文件
    try {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.tempDir, file));
      }
    } catch (error) {
      // 忽略清理错误
    }

    await super.cleanup();
  }
}

module.exports = OCRRecognizer;
