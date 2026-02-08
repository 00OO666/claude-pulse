/**
 * Keyboard Controller Module - 键盘模拟控制模块
 *
 * 功能：
 * 1. 键盘输入模拟（文本输入、按键、组合键）
 * 2. 窗口管理（查找、激活、切换）
 * 3. 鼠标操作（移动、点击、滚动）
 * 4. 屏幕操作（截图、获取尺寸）
 * 5. 安全措施（操作确认、紧急停止、日志）
 */

const HeartbeatModule = require('../module-interface');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const execAsync = promisify(exec);

class KeyboardController extends HeartbeatModule {
  constructor(name, config, core) {
    super(name, config, core);

    // 禁用定时执行（这是一个工具模块，不需要定期执行）
    this.interval = 0;

    // 配置
    this.safeMode = config.safeMode !== false; // 默认启用安全模式
    this.defaultDelay = config.defaultDelay || 100; // 默认延迟（毫秒）
    this.confirmActions = config.confirmActions !== false; // 默认需要确认
    this.logActions = config.logActions !== false; // 默认记录操作日志

    // 状态
    this.recording = false;
    this.recordedActions = [];
    this.emergencyStop = false;

    // robotjs 实例（延迟加载）
    this.robot = null;
    this.robotAvailable = false;
  }

  /**
   * 初始化模块
   */
  async init() {
    await super.init();

    // 尝试加载 robotjs
    try {
      this.robot = require('robotjs');
      this.robotAvailable = true;
      this.log('robotjs loaded successfully');
    } catch (error) {
      this.robotAvailable = false;
      this.log(`robotjs not available: ${error.message}`, 'warn');
      this.log('Falling back to Windows-specific commands', 'info');
    }

    this.log('Keyboard controller initialized');
  }

  /**
   * 执行任务（空实现，因为这是工具模块）
   */
  async execute() {
    // 工具模块不需要定期执行任务
  }

  // ==================== 键盘操作 ====================

  /**
   * 输入文本
   * @param {string} text - 要输入的文本
   * @param {number} delay - 每个字符之间的延迟（毫秒）
   */
  async typeString(text, delay = this.defaultDelay) {
    if (this.emergencyStop) {
      throw new Error('Emergency stop activated');
    }

    if (this.safeMode && this.confirmActions) {
      this.log(`Requesting confirmation to type: "${text.substring(0, 50)}..."`);
      // 在实际使用中，这里应该等待用户确认
    }

    if (this.logActions) {
      this.log(`Typing text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    }

    if (this.recording) {
      this.recordedActions.push({ action: 'typeString', text, delay, timestamp: Date.now() });
    }

    if (this.robotAvailable) {
      // 使用 robotjs
      for (const char of text) {
        if (this.emergencyStop) break;
        this.robot.typeString(char);
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    } else {
      // 使用 Windows PowerShell
      await this.typeStringWindows(text);
    }

    this.emit('keyboard:type', { text, timestamp: Date.now() });
  }

  /**
   * 按键
   * @param {string} key - 按键名称
   * @param {Array<string>} modifiers - 修饰键（如 ['control', 'shift']）
   */
  async keyTap(key, modifiers = []) {
    if (this.emergencyStop) {
      throw new Error('Emergency stop activated');
    }

    if (this.logActions) {
      const modStr = modifiers.length > 0 ? modifiers.join('+') + '+' : '';
      this.log(`Key tap: ${modStr}${key}`);
    }

    if (this.recording) {
      this.recordedActions.push({ action: 'keyTap', key, modifiers, timestamp: Date.now() });
    }

    if (this.robotAvailable) {
      this.robot.keyTap(key, modifiers);
    } else {
      await this.keyTapWindows(key, modifiers);
    }

    this.emit('keyboard:tap', { key, modifiers, timestamp: Date.now() });
  }

  /**
   * 按下组合键
   * @param {string} combination - 组合键字符串（如 'ctrl+c', 'ctrl+shift+v'）
   */
  async pressKeyCombination(combination) {
    const parts = combination.toLowerCase().split('+');
    const key = parts.pop();
    const modifiers = parts.map(mod => {
      // 标准化修饰键名称
      const modMap = {
        'ctrl': 'control',
        'cmd': 'command',
        'win': 'command',
        'alt': 'alt',
        'shift': 'shift'
      };
      return modMap[mod] || mod;
    });

    await this.keyTap(key, modifiers);
  }

  /**
   * 按下特殊键
   * @param {string} specialKey - 特殊键名称（enter, tab, esc, backspace等）
   */
  async pressSpecialKey(specialKey) {
    const keyMap = {
      'enter': 'enter',
      'return': 'enter',
      'tab': 'tab',
      'esc': 'escape',
      'escape': 'escape',
      'backspace': 'backspace',
      'delete': 'delete',
      'space': 'space',
      'up': 'up',
      'down': 'down',
      'left': 'left',
      'right': 'right',
      'home': 'home',
      'end': 'end',
      'pageup': 'pageup',
      'pagedown': 'pagedown'
    };

    const key = keyMap[specialKey.toLowerCase()] || specialKey;
    await this.keyTap(key);
  }

  // ==================== 窗口管理 ====================

  /**
   * 查找窗口
   * @param {string} titlePattern - 窗口标题模式（支持正则）
   * @returns {Array} 匹配的窗口列表
   */
  async findWindows(titlePattern) {
    if (this.logActions) {
      this.log(`Finding windows with pattern: ${titlePattern}`);
    }

    if (process.platform === 'win32') {
      return await this.findWindowsWindows(titlePattern);
    } else {
      this.log('Window finding not implemented for this platform', 'warn');
      return [];
    }
  }

  /**
   * 激活窗口
   * @param {string} titlePattern - 窗口标题模式
   */
  async activateWindow(titlePattern) {
    if (this.logActions) {
      this.log(`Activating window: ${titlePattern}`);
    }

    if (process.platform === 'win32') {
      await this.activateWindowWindows(titlePattern);
    } else {
      this.log('Window activation not implemented for this platform', 'warn');
    }

    this.emit('window:activate', { titlePattern, timestamp: Date.now() });
  }

  /**
   * 查找并激活 Claude Code 窗口
   */
  async activateClaudeCodeWindow() {
    const patterns = [
      'Claude Code',
      'claude-code',
      'Visual Studio Code'  // Claude Code 基于 VS Code
    ];

    for (const pattern of patterns) {
      try {
        await this.activateWindow(pattern);
        this.log(`Claude Code window activated with pattern: ${pattern}`);
        return true;
      } catch (error) {
        // 继续尝试下一个模式
      }
    }

    this.log('Failed to find Claude Code window', 'warn');
    return false;
  }

  /**
   * 获取活动窗口信息
   */
  async getActiveWindow() {
    if (process.platform === 'win32') {
      return await this.getActiveWindowWindows();
    } else {
      this.log('Get active window not implemented for this platform', 'warn');
      return null;
    }
  }

  // ==================== 鼠标操作 ====================

  /**
   * 移动鼠标
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   */
  async moveMouse(x, y) {
    if (this.emergencyStop) {
      throw new Error('Emergency stop activated');
    }

    if (this.logActions) {
      this.log(`Moving mouse to: (${x}, ${y})`);
    }

    if (this.recording) {
      this.recordedActions.push({ action: 'moveMouse', x, y, timestamp: Date.now() });
    }

    if (this.robotAvailable) {
      this.robot.moveMouse(x, y);
    } else {
      this.log('Mouse movement requires robotjs', 'warn');
    }

    this.emit('mouse:move', { x, y, timestamp: Date.now() });
  }

  /**
   * 点击鼠标
   * @param {string} button - 按钮（'left', 'right', 'middle'）
   * @param {boolean} double - 是否双击
   */
  async clickMouse(button = 'left', double = false) {
    if (this.emergencyStop) {
      throw new Error('Emergency stop activated');
    }

    if (this.logActions) {
      this.log(`Mouse ${double ? 'double ' : ''}click: ${button}`);
    }

    if (this.recording) {
      this.recordedActions.push({ action: 'clickMouse', button, double, timestamp: Date.now() });
    }

    if (this.robotAvailable) {
      this.robot.mouseClick(button, double);
    } else {
      this.log('Mouse click requires robotjs', 'warn');
    }

    this.emit('mouse:click', { button, double, timestamp: Date.now() });
  }

  /**
   * 滚动鼠标
   * @param {number} x - 水平滚动量
   * @param {number} y - 垂直滚动量
   */
  async scrollMouse(x, y) {
    if (this.emergencyStop) {
      throw new Error('Emergency stop activated');
    }

    if (this.logActions) {
      this.log(`Mouse scroll: (${x}, ${y})`);
    }

    if (this.robotAvailable) {
      this.robot.scrollMouse(x, y);
    } else {
      this.log('Mouse scroll requires robotjs', 'warn');
    }

    this.emit('mouse:scroll', { x, y, timestamp: Date.now() });
  }

  /**
   * 获取鼠标位置
   */
  getMousePosition() {
    if (this.robotAvailable) {
      return this.robot.getMousePos();
    } else {
      this.log('Get mouse position requires robotjs', 'warn');
      return { x: 0, y: 0 };
    }
  }

  // ==================== 屏幕操作 ====================

  /**
   * 截图
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @returns {Object} 截图数据
   */
  captureScreen(x, y, width, height) {
    if (this.robotAvailable) {
      return this.robot.screen.capture(x, y, width, height);
    } else {
      this.log('Screen capture requires robotjs', 'warn');
      return null;
    }
  }

  /**
   * 获取屏幕尺寸
   */
  getScreenSize() {
    if (this.robotAvailable) {
      return this.robot.getScreenSize();
    } else {
      this.log('Get screen size requires robotjs', 'warn');
      return { width: 1920, height: 1080 }; // 默认值
    }
  }

  // ==================== 操作录制和回放 ====================

  /**
   * 开始录制操作
   */
  startRecording() {
    this.recording = true;
    this.recordedActions = [];
    this.log('Started recording actions');
  }

  /**
   * 停止录制操作
   */
  stopRecording() {
    this.recording = false;
    this.log(`Stopped recording. Total actions: ${this.recordedActions.length}`);
    return this.recordedActions;
  }

  /**
   * 回放录制的操作
   * @param {Array} actions - 操作列表（可选，默认使用录制的操作）
   */
  async replayActions(actions = null) {
    const actionsToReplay = actions || this.recordedActions;

    if (actionsToReplay.length === 0) {
      this.log('No actions to replay', 'warn');
      return;
    }

    this.log(`Replaying ${actionsToReplay.length} actions...`);

    for (const action of actionsToReplay) {
      if (this.emergencyStop) {
        this.log('Replay stopped by emergency stop', 'warn');
        break;
      }

      try {
        switch (action.action) {
          case 'typeString':
            await this.typeString(action.text, action.delay);
            break;
          case 'keyTap':
            await this.keyTap(action.key, action.modifiers);
            break;
          case 'moveMouse':
            await this.moveMouse(action.x, action.y);
            break;
          case 'clickMouse':
            await this.clickMouse(action.button, action.double);
            break;
          default:
            this.log(`Unknown action type: ${action.action}`, 'warn');
        }

        // 添加小延迟以模拟真实操作
        await this.sleep(50);
      } catch (error) {
        this.log(`Error replaying action: ${error.message}`, 'error');
      }
    }

    this.log('Replay completed');
  }

  // ==================== 安全措施 ====================

  /**
   * 激活紧急停止
   */
  activateEmergencyStop() {
    this.emergencyStop = true;
    this.log('EMERGENCY STOP ACTIVATED', 'warn');
    this.emit('keyboard:emergency-stop', { timestamp: Date.now() });
  }

  /**
   * 取消紧急停止
   */
  deactivateEmergencyStop() {
    this.emergencyStop = false;
    this.log('Emergency stop deactivated');
  }

  /**
   * 设置安全模式
   */
  setSafeMode(enabled) {
    this.safeMode = enabled;
    this.log(`Safe mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ==================== Windows 特定实现 ====================

  /**
   * Windows: 输入文本
   */
  async typeStringWindows(text) {
    // 使用 PowerShell 的 SendKeys
    const escapedText = text.replace(/"/g, '""').replace(/\n/g, '{ENTER}');
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("${escapedText}")
    `;

    try {
      await execAsync(`pwsh -Command "${script.replace(/\n/g, ' ')}"`);
    } catch (error) {
      this.log(`Failed to type string on Windows: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Windows: 按键
   */
  async keyTapWindows(key, modifiers = []) {
    // 构建 SendKeys 格式的按键字符串
    let keyString = '';

    // 添加修饰键
    for (const mod of modifiers) {
      if (mod === 'control') keyString += '^';
      else if (mod === 'alt') keyString += '%';
      else if (mod === 'shift') keyString += '+';
    }

    // 添加主键
    const keyMap = {
      'enter': '{ENTER}',
      'tab': '{TAB}',
      'escape': '{ESC}',
      'backspace': '{BACKSPACE}',
      'delete': '{DELETE}',
      'space': ' ',
      'up': '{UP}',
      'down': '{DOWN}',
      'left': '{LEFT}',
      'right': '{RIGHT}',
      'home': '{HOME}',
      'end': '{END}',
      'pageup': '{PGUP}',
      'pagedown': '{PGDN}'
    };

    keyString += keyMap[key.toLowerCase()] || key;

    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("${keyString}")
    `;

    try {
      await execAsync(`pwsh -Command "${script.replace(/\n/g, ' ')}"`);
    } catch (error) {
      this.log(`Failed to tap key on Windows: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 执行 PowerShell 脚本（使用临时文件）
   */
  async executePowerShellScript(script) {
    const tempFile = path.join(os.tmpdir(), `ps-${Date.now()}.ps1`);

    try {
      // 写入临时文件
      fs.writeFileSync(tempFile, script, 'utf8');

      // 执行脚本（使用 -NoProfile 避免加载配置文件）
      const { stdout, stderr } = await execAsync(`pwsh -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`);

      // 删除临时文件
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // 忽略删除错误
      }

      return { stdout, stderr };
    } catch (error) {
      // 删除临时文件
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // 忽略删除错误
      }

      throw error;
    }
  }

  /**
   * Windows: 查找窗口
   */
  async findWindowsWindows(titlePattern) {
    const script = `
Get-Process | Where-Object { $_.MainWindowTitle -match '${titlePattern}' } |
Select-Object Id, ProcessName, MainWindowTitle |
ConvertTo-Json
`;

    try {
      const { stdout } = await this.executePowerShellScript(script);
      if (!stdout || stdout.trim() === '') {
        return [];
      }
      const windows = JSON.parse(stdout);
      return Array.isArray(windows) ? windows : [windows];
    } catch (error) {
      this.log(`Failed to find windows: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Windows: 激活窗口
   */
  async activateWindowWindows(titlePattern) {
    const script = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

Add-Type -TypeDefinition $code

$process = Get-Process | Where-Object { $_.MainWindowTitle -match '${titlePattern}' } | Select-Object -First 1

if ($process) {
  [Win32]::SetForegroundWindow($process.MainWindowHandle)
  Write-Output 'Window activated'
} else {
  Write-Error 'Window not found'
}
`;

    try {
      await this.executePowerShellScript(script);
    } catch (error) {
      this.log(`Failed to activate window: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Windows: 获取活动窗口
   */
  async getActiveWindowWindows() {
    const script = `
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
'@

Add-Type -TypeDefinition $code

$hwnd = [Win32]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $title, 256)
Write-Output $title.ToString()
`;

    try {
      const { stdout } = await this.executePowerShellScript(script);
      return { title: stdout.trim() };
    } catch (error) {
      this.log(`Failed to get active window: ${error.message}`, 'error');
      return null;
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 延迟
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 销毁模块
   */
  async destroy() {
    this.emergencyStop = true;
    await super.destroy();
    this.log('Keyboard controller destroyed');
  }
}

module.exports = KeyboardController;

