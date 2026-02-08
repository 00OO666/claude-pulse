# Keyboard Controller Module

键盘模拟控制模块 - 提供键盘、鼠标、窗口和屏幕操作的完整功能。

## 功能特性

### 1. 键盘操作
- **文本输入**: 模拟键盘输入文本
- **按键操作**: 模拟单个按键或组合键
- **特殊键**: 支持 Enter、Tab、Esc 等特殊键

### 2. 窗口管理
- **查找窗口**: 根据标题模式查找窗口
- **激活窗口**: 将指定窗口置于前台
- **获取活动窗口**: 获取当前活动窗口信息
- **Claude Code 窗口**: 快速激活 Claude Code 窗口

### 3. 鼠标操作
- **移动鼠标**: 移动鼠标到指定坐标
- **点击**: 左键、右键、中键点击
- **滚动**: 水平和垂直滚动
- **获取位置**: 获取当前鼠标位置

### 4. 屏幕操作
- **截图**: 捕获屏幕区域
- **获取尺寸**: 获取屏幕分辨率

### 5. 操作录制和回放
- **录制**: 记录所有操作
- **回放**: 重放录制的操作序列

### 6. 安全措施
- **安全模式**: 防止误操作
- **紧急停止**: 立即停止所有操作
- **操作日志**: 记录所有操作历史
- **操作确认**: 可选的操作前确认

## 技术实现

### 依赖库
- **robotjs** (可选): 跨平台的键盘/鼠标控制库
- **PowerShell** (Windows): 当 robotjs 不可用时的备用方案

### 平台支持
- ✅ Windows (完整支持)
- ⚠️ macOS (需要 robotjs)
- ⚠️ Linux (需要 robotjs)

## 使用示例

### 基本使用

```javascript
const KeyboardController = require('./modules/keyboard-controller');

// 创建实例
const controller = new KeyboardController('keyboard-controller', {
  enabled: true,
  safeMode: true,
  defaultDelay: 100,
  confirmActions: false,
  logActions: true
}, core);

// 初始化
await controller.init();

// 输入文本
await controller.typeString('Hello, World!');

// 按键
await controller.keyTap('enter');

// 组合键
await controller.pressKeyCombination('ctrl+c');

// 查找窗口
const windows = await controller.findWindows('Claude Code');

// 激活窗口
await controller.activateWindow('Claude Code');

// 移动鼠标
await controller.moveMouse(100, 200);

// 点击
await controller.clickMouse('left');
```

### 操作录制和回放

```javascript
// 开始录制
controller.startRecording();

// 执行一些操作
await controller.typeString('Test');
await controller.keyTap('enter');

// 停止录制
const actions = controller.stopRecording();

// 回放操作
await controller.replayActions(actions);
```

### 安全控制

```javascript
// 启用安全模式
controller.setSafeMode(true);

// 激活紧急停止
controller.activateEmergencyStop();

// 取消紧急停止
controller.deactivateEmergencyStop();
```

## API 文档

### 键盘操作

#### `typeString(text, delay)`
输入文本字符串。

- `text` (string): 要输入的文本
- `delay` (number): 每个字符之间的延迟（毫秒），默认 100ms

#### `keyTap(key, modifiers)`
按下单个按键。

- `key` (string): 按键名称（如 'a', 'enter', 'tab'）
- `modifiers` (Array<string>): 修饰键数组（如 ['control', 'shift']）

#### `pressKeyCombination(combination)`
按下组合键。

- `combination` (string): 组合键字符串（如 'ctrl+c', 'ctrl+shift+v'）

#### `pressSpecialKey(specialKey)`
按下特殊键。

- `specialKey` (string): 特殊键名称（enter, tab, esc, backspace, delete, space, up, down, left, right, home, end, pageup, pagedown）

### 窗口管理

#### `findWindows(titlePattern)`
查找匹配的窗口。

- `titlePattern` (string): 窗口标题模式（支持正则表达式）
- 返回: `Array<Object>` 窗口列表

#### `activateWindow(titlePattern)`
激活指定窗口。

- `titlePattern` (string): 窗口标题模式

#### `activateClaudeCodeWindow()`
激活 Claude Code 窗口。

- 返回: `boolean` 是否成功

#### `getActiveWindow()`
获取当前活动窗口。

- 返回: `Object` 窗口信息

### 鼠标操作

#### `moveMouse(x, y)`
移动鼠标到指定位置。

- `x` (number): X 坐标
- `y` (number): Y 坐标

#### `clickMouse(button, double)`
点击鼠标。

- `button` (string): 按钮（'left', 'right', 'middle'），默认 'left'
- `double` (boolean): 是否双击，默认 false

#### `scrollMouse(x, y)`
滚动鼠标。

- `x` (number): 水平滚动量
- `y` (number): 垂直滚动量

#### `getMousePosition()`
获取鼠标位置。

- 返回: `Object` { x, y }

### 屏幕操作

#### `captureScreen(x, y, width, height)`
截取屏幕区域。

- `x` (number): X 坐标
- `y` (number): Y 坐标
- `width` (number): 宽度
- `height` (number): 高度
- 返回: `Object` 截图数据

#### `getScreenSize()`
获取屏幕尺寸。

- 返回: `Object` { width, height }

### 操作录制

#### `startRecording()`
开始录制操作。

#### `stopRecording()`
停止录制操作。

- 返回: `Array<Object>` 录制的操作列表

#### `replayActions(actions)`
回放操作。

- `actions` (Array<Object>): 操作列表（可选，默认使用录制的操作）

### 安全控制

#### `activateEmergencyStop()`
激活紧急停止。

#### `deactivateEmergencyStop()`
取消紧急停止。

#### `setSafeMode(enabled)`
设置安全模式。

- `enabled` (boolean): 是否启用

## 配置选项

```javascript
{
  enabled: true,              // 是否启用模块
  safeMode: true,             // 安全模式（防止误操作）
  defaultDelay: 100,          // 默认延迟（毫秒）
  confirmActions: false,      // 是否需要确认操作
  logActions: true            // 是否记录操作日志
}
```

## 事件

模块会触发以下事件：

- `keyboard:type` - 文本输入事件
- `keyboard:tap` - 按键事件
- `keyboard:emergency-stop` - 紧急停止事件
- `window:activate` - 窗口激活事件
- `mouse:move` - 鼠标移动事件
- `mouse:click` - 鼠标点击事件
- `mouse:scroll` - 鼠标滚动事件

## 注意事项

### 安全性
1. **谨慎使用**: 键盘/鼠标模拟功能强大，使用时需谨慎
2. **安全模式**: 建议在生产环境中启用安全模式
3. **紧急停止**: 遇到问题时立即使用紧急停止功能
4. **操作日志**: 启用日志记录以便追踪问题

### robotjs 安装
robotjs 需要编译，可能需要以下工具：
- Windows: Visual Studio Build Tools
- macOS: Xcode Command Line Tools
- Linux: build-essential

如果 robotjs 安装失败，模块会自动回退到 Windows 特定实现（仅限 Windows）。

### Windows 特定实现
当 robotjs 不可用时，模块会使用 PowerShell 实现以下功能：
- ✅ 文本输入（SendKeys）
- ✅ 按键操作（SendKeys）
- ✅ 窗口查找和激活（Win32 API）
- ❌ 鼠标操作（需要 robotjs）
- ❌ 屏幕截图（需要 robotjs）

## 测试

运行测试脚本：

```bash
node test-keyboard-controller.js
```

测试内容：
- 模块初始化
- 屏幕尺寸获取
- 鼠标位置获取
- 窗口查找
- 活动窗口获取
- 操作录制和回放
- 紧急停止
- 安全模式

## 故障排除

### robotjs 安装失败
如果 robotjs 安装失败，可以：
1. 在 Windows 上使用内置的 PowerShell 实现
2. 安装编译工具后重新安装 robotjs
3. 使用预编译的 robotjs 二进制文件

### PowerShell 执行策略错误
如果遇到 PowerShell 执行策略错误：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 窗口激活失败
如果窗口激活失败：
1. 检查窗口标题是否正确
2. 确保窗口存在且可见
3. 尝试使用更精确的标题模式

## 许可证

MIT License
