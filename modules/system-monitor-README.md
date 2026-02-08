# System Monitor Module

系统资源监控模块，用于实时监控系统资源使用情况。

## 功能特性

### 监控指标

1. **CPU监控**
   - 总体CPU使用率
   - 每个核心的使用率
   - CPU温度（如果可用）

2. **内存监控**
   - 总内存容量
   - 已用内存
   - 可用内存
   - 内存使用率百分比

3. **磁盘监控**
   - 所有文件系统的使用情况
   - 磁盘I/O速度（读/写）
   - 累计I/O统计

4. **网络监控**
   - 所有网络接口的流量
   - 实时上传/下载速度
   - 累计流量统计

5. **进程监控**
   - Claude Code相关进程
   - 进程CPU使用率
   - 进程内存占用

### 告警功能

- 可配置的阈值
- 自动发送告警通知
- 告警冷却期（避免频繁告警）
- 支持的告警类型：
  - CPU使用率过高
  - 内存使用率过高
  - 磁盘使用率过高
  - 网络流量异常

### 数据存储

- 内存中保存历史数据
- 可配置历史记录大小
- 提供数据查询API
- 支持图表数据格式导出

## 配置选项

```json
{
  "enabled": true,
  "interval": 60000,
  "maxHistorySize": 100,
  "thresholds": {
    "cpu": 80,
    "memory": 85,
    "disk": 90,
    "networkRx": 104857600,
    "networkTx": 104857600
  },
  "alertCooldown": 600000,
  "claudeProcessName": "claude"
}
```

### 配置说明

- `enabled`: 是否启用模块
- `interval`: 数据采集间隔（毫秒）
- `maxHistorySize`: 最大历史记录数量
- `thresholds`: 告警阈值
  - `cpu`: CPU使用率阈值（%）
  - `memory`: 内存使用率阈值（%）
  - `disk`: 磁盘使用率阈值（%）
  - `networkRx`: 下载速度阈值（字节/秒）
  - `networkTx`: 上传速度阈值（字节/秒）
- `alertCooldown`: 告警冷却期（毫秒）
- `claudeProcessName`: Claude进程名称（用于进程监控）

## API

### getCurrentData()

获取最新的系统数据。

```javascript
const currentData = monitor.getCurrentData();
console.log(currentData);
```

返回格式：
```javascript
{
  timestamp: 1234567890,
  cpu: { overall: 25.5, cores: [...], temperature: null },
  memory: { total: 16GB, used: 8GB, ... },
  disk: { filesystems: [...], io: {...} },
  network: { interfaces: [...], speed: {...} },
  process: { found: true, processes: [...] }
}
```

### getHistoryData(limit)

获取历史数据。

```javascript
// 获取所有历史数据
const allHistory = monitor.getHistoryData();

// 获取最近50条记录
const recentHistory = monitor.getHistoryData(50);
```

### getChartData(metric, limit)

获取图表数据格式。

```javascript
// 获取CPU图表数据
const cpuChart = monitor.getChartData('cpu', 50);

// 支持的指标：
// - 'cpu': CPU使用率
// - 'memory': 内存使用率
// - 'network-rx': 下载速度
// - 'network-tx': 上传速度
// - 'disk-read': 磁盘读取速度
// - 'disk-write': 磁盘写入速度
```

返回格式：
```javascript
[
  { timestamp: 1234567890, value: 25.5 },
  { timestamp: 1234567891, value: 26.3 },
  ...
]
```

## 事件

模块会触发以下事件：

### system:data-collected

数据采集完成时触发。

```javascript
monitor.on('system:data-collected', (data) => {
  console.log('Data collected:', data);
});
```

### system:alert

告警触发时触发。

```javascript
monitor.on('system:alert', (alert) => {
  console.log('Alert:', alert.type, alert.value);
});
```

## 使用示例

```javascript
const SystemMonitor = require('./modules/system-monitor');

// 创建模块实例
const monitor = new SystemMonitor('system-monitor', config, core);

// 初始化
await monitor.init();

// 启动监控
await monitor.start();

// 获取当前数据
const data = monitor.getCurrentData();
console.log('CPU:', data.cpu.overall + '%');
console.log('Memory:', data.memory.usagePercent + '%');

// 获取图表数据
const cpuChart = monitor.getChartData('cpu', 50);

// 停止监控
await monitor.stop();
```

## 测试

运行测试脚本：

```bash
node test-system-monitor.js
```

## 依赖

- `systeminformation`: 系统信息采集库

## 注意事项

1. 磁盘I/O和网络速度需要至少两次采集才能计算
2. 第一次采集时速度值为0是正常的
3. 某些系统可能无法获取CPU温度
4. 进程监控依赖于进程名称匹配
5. 告警冷却期可以避免频繁发送相同告警

## 许可证

MIT
