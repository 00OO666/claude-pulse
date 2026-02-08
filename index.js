#!/usr/bin/env node
/**
 * Heartbeat V2 - 主入口
 *
 * 使用方法：
 *   node index.js              - 启动守护进程
 *   node index.js --once       - 执行一次所有模块任务
 *   node index.js --config <path> - 使用自定义配置文件
 */

const path = require('path');
const HeartbeatCore = require('./heartbeat-core');

// 解析命令行参数
const args = process.argv.slice(2);
let configPath = path.join(__dirname, 'config.json');
let mode = 'daemon';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && args[i + 1]) {
    configPath = args[i + 1];
    i++;
  } else if (args[i] === '--once') {
    mode = 'once';
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Heartbeat V2 - 模块化心跳监控系统');
    console.log('');
    console.log('使用方法:');
    console.log('  node index.js              启动守护进程');
    console.log('  node index.js --once       执行一次所有模块任务');
    console.log('  node index.js --config <path>  使用自定义配置文件');
    console.log('  node index.js --help       显示帮助信息');
    process.exit(0);
  }
}

// 主函数
async function main() {
  const core = new HeartbeatCore(configPath);

  try {
    // 初始化
    await core.init();

    if (mode === 'once') {
      // 单次执行模式
      core.log('Running in once mode', 'info');

      // 执行所有模块一次
      for (const [name, module] of core.modules) {
        if (module.enabled) {
          try {
            await module.execute();
          } catch (error) {
            core.log(`Module ${name} execution failed: ${error.message}`, 'error');
          }
        }
      }

      core.log('All modules executed', 'info');
      process.exit(0);

    } else {
      // 守护进程模式
      core.log('Running in daemon mode', 'info');
      await core.start();
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// 处理退出信号
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// 运行
main();
