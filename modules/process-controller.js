/**
 * Process Controller Module - 进程控制模块
 *
 * 功能：
 * 1. 监控 VS Code/Claude Code 进程状态
 * 2. 管理 Claude Code 会话（通过文件系统）
 * 3. 执行系统级命令（清理、备份等）
 * 4. 提供进程信息和统计
 */

const HeartbeatModule = require('../module-interface');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ProcessController extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 配置
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.projectsDir = path.join(this.claudeDir, 'projects');
    this.logsDir = path.join(this.claudeDir, 'logs');

    // 命令白名单（安全措施）
    this.allowedCommands = [
      'list-sessions',
      'session-info',
      'clean-old-sessions',
      'backup-session',
      'process-status',
      'kill-process',
      'restart-process'
    ];

    // 进程监控状态
    this.processInfo = {
      vscode: null,
      lastCheck: null
    };

    // 操作日志
    this.operationLog = [];
    this.maxLogEntries = 100;
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();
    this.log('Process controller initialized');

    // 确保目录存在
    this.ensureDirectories();
  }

  /**
   * 执行模块任务 - 定期检查进程状态
   */
  async execute() {
    try {
      // 更新进程信息
      await this.updateProcessInfo();

      // 检查会话健康状态
      await this.checkSessionsHealth();

      // 清理过期日志
      this.cleanupOperationLog();
    } catch (error) {
      this.log(`Execute failed: ${error.message}`, 'error');
    }
  }

  /**
   * 确保必要的目录存在
   */
  ensureDirectories() {
    const dirs = [this.claudeDir, this.projectsDir, this.logsDir];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          this.log(`Created directory: ${dir}`);
        } catch (error) {
          this.log(`Failed to create directory ${dir}: ${error.message}`, 'error');
        }
      }
    }
  }

  /**
   * 更新进程信息
   */
  async updateProcessInfo() {
    try {
      const processes = await this.findVSCodeProcesses();

      this.processInfo = {
        vscode: processes,
        lastCheck: Date.now()
      };

      // 触发进程状态更新事件
      this.emit('process-controller:status-update', this.processInfo);
    } catch (error) {
      this.log(`Failed to update process info: ${error.message}`, 'error');
    }
  }

  /**
   * 查找 VS Code 进程
   */
  async findVSCodeProcesses() {
    return new Promise((resolve, reject) => {
      const isWindows = os.platform() === 'win32';
      const command = isWindows
        ? 'tasklist /FI "IMAGENAME eq Code.exe" /FO CSV /NH'
        : 'ps aux | grep -i "code" | grep -v grep';

      exec(command, (error, stdout, stderr) => {
        if (error) {
          // 没有找到进程不算错误
          resolve([]);
          return;
        }

        try {
          const processes = this.parseProcessList(stdout, isWindows);
          resolve(processes);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * 解析进程列表
   */
  parseProcessList(output, isWindows) {
    if (!output || !output.trim()) {
      return [];
    }

    const processes = [];
    const lines = output.trim().split('\n');

    if (isWindows) {
      // Windows CSV 格式: "Image Name","PID","Session Name","Session#","Mem Usage"
      for (const line of lines) {
        const match = line.match(/"([^"]+)","(\d+)","([^"]+)","(\d+)","([^"]+)"/);
        if (match) {
          processes.push({
            name: match[1],
            pid: parseInt(match[2]),
            session: match[3],
            memory: match[5]
          });
        }
      }
    } else {
      // Unix 格式
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          processes.push({
            user: parts[0],
            pid: parseInt(parts[1]),
            cpu: parts[2],
            memory: parts[3],
            command: parts.slice(10).join(' ')
          });
        }
      }
    }

    return processes;
  }

  /**
   * 检查会话健康状态
   */
  async checkSessionsHealth() {
    try {
      if (!fs.existsSync(this.projectsDir)) {
        return;
      }

      const sessions = await this.listSessions();
      const now = Date.now();
      const oldThreshold = 30 * 24 * 60 * 60 * 1000; // 30天

      let oldCount = 0;
      for (const session of sessions) {
        if (now - session.modified > oldThreshold) {
          oldCount++;
        }
      }

      if (oldCount > 0) {
        this.log(`Found ${oldCount} old sessions (>30 days)`, 'warn');
        this.emit('process-controller:old-sessions', { count: oldCount });
      }
    } catch (error) {
      this.log(`Failed to check sessions health: ${error.message}`, 'error');
    }
  }

  /**
   * 列出所有会话
   */
  async listSessions() {
    if (!fs.existsSync(this.projectsDir)) {
      return [];
    }

    const projects = fs.readdirSync(this.projectsDir);
    const sessions = [];

    for (const project of projects) {
      try {
        const projectPath = path.join(this.projectsDir, project);
        const stat = fs.statSync(projectPath);

        if (stat.isDirectory()) {
          sessions.push({
            name: project,
            path: projectPath,
            created: stat.birthtime,
            modified: stat.mtime,
            size: await this.getDirectorySize(projectPath)
          });
        }
      } catch (error) {
        this.log(`Failed to read session ${project}: ${error.message}`, 'error');
      }
    }

    return sessions.sort((a, b) => b.modified - a.modified);
  }

  /**
   * 获取会话详情
   */
  async getSessionInfo(sessionName) {
    const sessionPath = path.join(this.projectsDir, sessionName);

    if (!fs.existsSync(sessionPath)) {
      throw new Error(`Session not found: ${sessionName}`);
    }

    const stat = fs.statSync(sessionPath);
    const files = fs.readdirSync(sessionPath);

    return {
      name: sessionName,
      path: sessionPath,
      created: stat.birthtime,
      modified: stat.mtime,
      size: await this.getDirectorySize(sessionPath),
      fileCount: files.length,
      files: files.slice(0, 20) // 只返回前20个文件
    };
  }

  /**
   * 清理旧会话
   */
  async cleanOldSessions(daysOld = 30) {
    const sessions = await this.listSessions();
    const now = Date.now();
    const threshold = daysOld * 24 * 60 * 60 * 1000;
    const cleaned = [];

    for (const session of sessions) {
      if (now - session.modified > threshold) {
        try {
          await this.deleteDirectory(session.path);
          cleaned.push(session.name);
          this.logOperation('clean-session', { session: session.name, age: daysOld });
        } catch (error) {
          this.log(`Failed to clean session ${session.name}: ${error.message}`, 'error');
        }
      }
    }

    return cleaned;
  }

  /**
   * 备份会话
   */
  async backupSession(sessionName, backupDir) {
    const sessionPath = path.join(this.projectsDir, sessionName);

    if (!fs.existsSync(sessionPath)) {
      throw new Error(`Session not found: ${sessionName}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${sessionName}_${timestamp}`;
    const backupPath = path.join(backupDir, backupName);

    await this.copyDirectory(sessionPath, backupPath);
    this.logOperation('backup-session', { session: sessionName, backup: backupPath });

    return backupPath;
  }

  /**
   * 执行命令（带白名单验证）
   */
  async executeCommand(command, args = []) {
    // 验证命令是否在白名单中
    if (!this.allowedCommands.includes(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    this.logOperation('execute-command', { command, args });

    // 执行对应的命令
    switch (command) {
      case 'list-sessions':
        return await this.listSessions();

      case 'session-info':
        return await this.getSessionInfo(args[0]);

      case 'clean-old-sessions':
        return await this.cleanOldSessions(args[0] || 30);

      case 'backup-session':
        return await this.backupSession(args[0], args[1]);

      case 'process-status':
        return this.processInfo;

      case 'kill-process':
        return await this.killProcess(args[0]);

      case 'restart-process':
        return await this.restartProcess(args[0]);

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * 终止进程
   */
  async killProcess(pid) {
    return new Promise((resolve, reject) => {
      const isWindows = os.platform() === 'win32';
      const command = isWindows
        ? `taskkill /PID ${pid} /F`
        : `kill -9 ${pid}`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        this.logOperation('kill-process', { pid });
        resolve({ success: true, pid, output: stdout });
      });
    });
  }

  /**
   * 重启进程（仅记录，实际重启需要外部工具）
   */
  async restartProcess(pid) {
    this.log(`Restart process ${pid} requested (manual restart required)`, 'warn');
    this.logOperation('restart-process', { pid });

    return {
      success: false,
      message: 'Automatic restart not supported. Please restart manually.'
    };
  }

  /**
   * 记录操作日志
   */
  logOperation(operation, details = {}) {
    const entry = {
      timestamp: Date.now(),
      operation,
      details
    };

    this.operationLog.push(entry);

    // 限制日志条目数量
    if (this.operationLog.length > this.maxLogEntries) {
      this.operationLog.shift();
    }

    this.log(`Operation: ${operation} - ${JSON.stringify(details)}`);
  }

  /**
   * 清理操作日志
   */
  cleanupOperationLog() {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天

    this.operationLog = this.operationLog.filter(entry => {
      return now - entry.timestamp < maxAge;
    });
  }

  /**
   * 获取操作日志
   */
  getOperationLog(limit = 50) {
    return this.operationLog.slice(-limit);
  }

  /**
   * 工具方法: 获取目录大小
   */
  async getDirectorySize(dirPath) {
    let size = 0;

    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          size += await this.getDirectorySize(filePath);
        } else {
          size += stat.size;
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }

    return size;
  }

  /**
   * 工具方法: 删除目录
   */
  async deleteDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        await this.deleteDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }

    fs.rmdirSync(dirPath);
  }

  /**
   * 工具方法: 复制目录
   */
  async copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);

    for (const file of files) {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

module.exports = ProcessController;
