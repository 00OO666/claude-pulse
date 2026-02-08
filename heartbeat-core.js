#!/usr/bin/env node
/**
 * Heartbeat Core - 核心框架
 *
 * 功能：
 * 1. 模块管理（加载、启动、停止）
 * 2. 配置管理
 * 3. 通知接口（统一消息发送）
 * 4. 事件系统（模块间通信）
 * 5. 日志系统
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const EventEmitter = require('events');

class HeartbeatCore extends EventEmitter {
  constructor(configPath) {
    super();
    this.configPath = configPath;
    this.config = null;
    this.modules = new Map();
    this.running = false;
  }

  /**
   * 初始化核心
   */
  async init() {
    // 加载配置
    this.loadConfig();

    // 初始化日志
    this.initLogger();

    // 加载模块
    await this.loadModules();

    this.log('Heartbeat Core initialized', 'info');
  }

  /**
   * 加载配置文件
   */
  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);

      // 展开路径中的 ~
      if (this.config.logging && this.config.logging.logFile) {
        this.config.logging.logFile = this.config.logging.logFile.replace(
          /^~/,
          os.homedir()
        );
      }

      this.log('Configuration loaded', 'info');
    } catch (error) {
      console.error('Failed to load config:', error.message);
      process.exit(1);
    }
  }

  /**
   * 初始化日志系统
   */
  initLogger() {
    if (!this.config.logging || !this.config.logging.enabled) {
      return;
    }

    const logDir = path.dirname(this.config.logging.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * 记录日志
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // 输出到控制台
    console.log(logMessage);

    // 写入日志文件
    if (this.config.logging && this.config.logging.enabled) {
      try {
        fs.appendFileSync(
          this.config.logging.logFile,
          logMessage + '\n'
        );
      } catch (error) {
        console.error('Failed to write log:', error.message);
      }
    }
  }

  /**
   * 加载所有模块
   */
  async loadModules() {
    const modulesDir = path.join(__dirname, 'modules');

    if (!fs.existsSync(modulesDir)) {
      this.log('Modules directory not found, skipping module loading', 'warn');
      return;
    }

    const moduleFiles = fs.readdirSync(modulesDir)
      .filter(file => file.endsWith('.js'));

    for (const file of moduleFiles) {
      const moduleName = path.basename(file, '.js');
      const moduleConfig = this.config.modules[moduleName];

      if (!moduleConfig) {
        this.log(`No config found for module: ${moduleName}`, 'warn');
        continue;
      }

      try {
        const ModuleClass = require(path.join(modulesDir, file));
        const moduleInstance = new ModuleClass(moduleName, moduleConfig, this);
        await moduleInstance.init();
        this.modules.set(moduleName, moduleInstance);
        this.log(`Module loaded: ${moduleName}`, 'info');
      } catch (error) {
        this.log(`Failed to load module ${moduleName}: ${error.message}`, 'error');
      }
    }
  }

  /**
   * 启动所有模块
   */
  async start() {
    if (this.running) {
      this.log('Heartbeat is already running', 'warn');
      return;
    }

    this.running = true;
    this.log('Starting all modules...', 'info');

    for (const [name, module] of this.modules) {
      try {
        await module.start();
      } catch (error) {
        this.log(`Failed to start module ${name}: ${error.message}`, 'error');
      }
    }

    this.log('All modules started', 'info');
  }

  /**
   * 停止所有模块
   */
  async stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.log('Stopping all modules...', 'info');

    for (const [name, module] of this.modules) {
      try {
        await module.stop();
      } catch (error) {
        this.log(`Failed to stop module ${name}: ${error.message}`, 'error');
      }
    }

    this.log('All modules stopped', 'info');
  }

  /**
   * 发送Telegram通知
   */
  async notify(message, options = {}) {
    const { botToken, chatId, parseMode } = this.config.telegram;

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: options.parseMode || parseMode
      });

      const requestOptions = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(requestOptions, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(responseData));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
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
   * 获取系统信息
   */
  getSystemInfo() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: `${hours}h ${minutes}m`,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      cwd: process.cwd()
    };
  }
}

module.exports = HeartbeatCore;
