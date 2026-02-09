// ClaudePulse 操作序列编辑器 JavaScript

let sequence = [];
let selectedAction = null;
let isPlaying = false;
let draggedElement = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initDragAndDrop();
  loadSavedSequences();
  updateStatus();
});

// 初始化拖拽功能
function initDragAndDrop() {
  const actionItems = document.querySelectorAll('.action-item');
  const sequenceContainer = document.getElementById('sequenceContainer');

  // 操作面板的拖拽
  actionItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedElement = e.target;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', item.dataset.type);
    });

    item.addEventListener('dragend', () => {
      draggedElement = null;
    });
  });

  // 序列容器的放置
  sequenceContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  sequenceContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const actionType = e.dataTransfer.getData('text/plain');
    if (actionType) {
      addAction(actionType);
    }
  });
}

// 添加操作
function addAction(type) {
  const action = createAction(type);
  sequence.push(action);
  renderSequence();
  updateStatus();
}

// 创建操作对象
function createAction(type) {
  const baseAction = {
    id: Date.now() + Math.random(),
    type,
    enabled: true
  };

  switch (type) {
    case 'click':
      return { ...baseAction, x: 0, y: 0, button: 'left', double: false };
    case 'type':
      return { ...baseAction, text: '', delay: 100 };
    case 'key':
      return { ...baseAction, key: 'enter', modifiers: [] };
    case 'wait':
      return { ...baseAction, duration: 1000 };
    case 'screenshot':
      return { ...baseAction, x: 0, y: 0, width: 1920, height: 1080, savePath: '' };
    case 'ocr':
      return { ...baseAction, x: 0, y: 0, width: 1920, height: 1080, language: 'eng' };
    case 'ai':
      return { ...baseAction, goal: '', region: { x: 0, y: 0, width: 1920, height: 1080 } };
    default:
      return baseAction;
  }
}

// 渲染序列
function renderSequence() {
  const container = document.getElementById('sequenceContainer');

  if (sequence.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">暂无操作</div>
        <div class="empty-state-hint">从左侧拖拽操作组件到这里</div>
      </div>
    `;
    return;
  }

  container.innerHTML = sequence.map((action, index) => `
    <div class="sequence-item" data-index="${index}" onclick="selectAction(${index})">
      <div class="sequence-header">
        <div class="sequence-title">
          ${getActionIcon(action.type)}
          <span>${getActionTitle(action.type)}</span>
          <span style="font-size: 12px; color: #999;">#${index + 1}</span>
        </div>
        <div class="sequence-actions">
          <button class="btn-icon" onclick="event.stopPropagation(); moveUp(${index})" title="上移">↑</button>
          <button class="btn-icon" onclick="event.stopPropagation(); moveDown(${index})" title="下移">↓</button>
          <button class="btn-icon" onclick="event.stopPropagation(); duplicateAction(${index})" title="复制">📋</button>
          <button class="btn-icon" onclick="event.stopPropagation(); deleteAction(${index})" title="删除">🗑️</button>
        </div>
      </div>
      <div class="sequence-params">
        ${renderActionParams(action)}
      </div>
    </div>
  `).join('');
}

// 获取操作图标
function getActionIcon(type) {
  const icons = {
    click: '🖱️',
    type: '⌨️',
    key: '🔑',
    wait: '⏱️',
    screenshot: '📸',
    ocr: '👁️',
    ai: '🤖'
  };
  return icons[type] || '❓';
}

// 获取操作标题
function getActionTitle(type) {
  const titles = {
    click: '点击',
    type: '输入文字',
    key: '按键',
    wait: '等待',
    screenshot: '截图',
    ocr: 'OCR识别',
    ai: 'AI操作'
  };
  return titles[type] || '未知操作';
}

// 渲染操作参数
function renderActionParams(action) {
  switch (action.type) {
    case 'click':
      return `
        <div class="param-group">
          <span class="param-label">X坐标</span>
          <span>${action.x}</span>
        </div>
        <div class="param-group">
          <span class="param-label">Y坐标</span>
          <span>${action.y}</span>
        </div>
        <div class="param-group">
          <span class="param-label">按钮</span>
          <span>${action.button}</span>
        </div>
      `;
    case 'type':
      return `
        <div class="param-group">
          <span class="param-label">文字</span>
          <span>${action.text || '(未设置)'}</span>
        </div>
        <div class="param-group">
          <span class="param-label">延迟</span>
          <span>${action.delay}ms</span>
        </div>
      `;
    case 'key':
      return `
        <div class="param-group">
          <span class="param-label">按键</span>
          <span>${action.key}</span>
        </div>
      `;
    case 'wait':
      return `
        <div class="param-group">
          <span class="param-label">时长</span>
          <span>${action.duration}ms</span>
        </div>
      `;
    case 'screenshot':
      return `
        <div class="param-group">
          <span class="param-label">区域</span>
          <span>${action.width}x${action.height}</span>
        </div>
      `;
    case 'ocr':
      return `
        <div class="param-group">
          <span class="param-label">语言</span>
          <span>${action.language}</span>
        </div>
      `;
    case 'ai':
      return `
        <div class="param-group">
          <span class="param-label">目标</span>
          <span>${action.goal || '(未设置)'}</span>
        </div>
      `;
    default:
      return '';
  }
}

// 选择操作
function selectAction(index) {
  selectedAction = index;
  renderProperties(sequence[index]);

  // 高亮选中的操作
  document.querySelectorAll('.sequence-item').forEach((item, i) => {
    if (i === index) {
      item.style.borderColor = '#667eea';
      item.style.background = '#f8f9ff';
    } else {
      item.style.borderColor = '#e0e0e0';
      item.style.background = 'white';
    }
  });
}

// 渲染属性面板
function renderProperties(action) {
  const container = document.getElementById('propertiesContent');

  let html = `
    <div class="property-group">
      <h4>基本信息</h4>
      <div class="form-group">
        <label class="form-label">操作类型</label>
        <input type="text" class="form-input" value="${getActionTitle(action.type)}" disabled>
      </div>
      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" ${action.enabled ? 'checked' : ''} onchange="updateActionProperty('enabled', this.checked)">
          启用此操作
        </label>
      </div>
    </div>
  `;

  // 根据操作类型添加特定属性
  switch (action.type) {
    case 'click':
      html += `
        <div class="property-group">
          <h4>点击参数</h4>
          <div class="form-group">
            <label class="form-label">X坐标</label>
            <input type="number" class="form-input" value="${action.x}" onchange="updateActionProperty('x', parseInt(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label">Y坐标</label>
            <input type="number" class="form-input" value="${action.y}" onchange="updateActionProperty('y', parseInt(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label">按钮</label>
            <select class="form-input" onchange="updateActionProperty('button', this.value)">
              <option value="left" ${action.button === 'left' ? 'selected' : ''}>左键</option>
              <option value="right" ${action.button === 'right' ? 'selected' : ''}>右键</option>
              <option value="middle" ${action.button === 'middle' ? 'selected' : ''}>中键</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" ${action.double ? 'checked' : ''} onchange="updateActionProperty('double', this.checked)">
              双击
            </label>
          </div>
        </div>
      `;
      break;

    case 'type':
      html += `
        <div class="property-group">
          <h4>输入参数</h4>
          <div class="form-group">
            <label class="form-label">文字内容</label>
            <textarea class="form-textarea" onchange="updateActionProperty('text', this.value)">${action.text}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">延迟 (毫秒)</label>
            <input type="number" class="form-input" value="${action.delay}" onchange="updateActionProperty('delay', parseInt(this.value))">
          </div>
        </div>
      `;
      break;

    case 'key':
      html += `
        <div class="property-group">
          <h4>按键参数</h4>
          <div class="form-group">
            <label class="form-label">按键</label>
            <input type="text" class="form-input" value="${action.key}" onchange="updateActionProperty('key', this.value)">
          </div>
        </div>
      `;
      break;

    case 'wait':
      html += `
        <div class="property-group">
          <h4>等待参数</h4>
          <div class="form-group">
            <label class="form-label">时长 (毫秒)</label>
            <input type="number" class="form-input" value="${action.duration}" onchange="updateActionProperty('duration', parseInt(this.value))">
          </div>
        </div>
      `;
      break;

    case 'screenshot':
      html += `
        <div class="property-group">
          <h4>截图参数</h4>
          <div class="form-group">
            <label class="form-label">X坐标</label>
            <input type="number" class="form-input" value="${action.x}" onchange="updateActionProperty('x', parseInt(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label">Y坐标</label>
            <input type="number" class="form-input" value="${action.y}" onchange="updateActionProperty('y', parseInt(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label">宽度</label>
            <input type="number" class="form-input" value="${action.width}" onchange="updateActionProperty('width', parseInt(this.value))">
          </div>
          <div class="form-group">
            <label class="form-label">高度</label>
            <input type="number" class="form-input" value="${action.height}" onchange="updateActionProperty('height', parseInt(this.value))">
          </div>
        </div>
      `;
      break;

    case 'ocr':
      html += `
        <div class="property-group">
          <h4>OCR参数</h4>
          <div class="form-group">
            <label class="form-label">语言</label>
            <select class="form-input" onchange="updateActionProperty('language', this.value)">
              <option value="eng" ${action.language === 'eng' ? 'selected' : ''}>英文</option>
              <option value="chi_sim" ${action.language === 'chi_sim' ? 'selected' : ''}>简体中文</option>
              <option value="chi_tra" ${action.language === 'chi_tra' ? 'selected' : ''}>繁体中文</option>
            </select>
          </div>
        </div>
      `;
      break;

    case 'ai':
      html += `
        <div class="property-group">
          <h4>AI操作参数</h4>
          <div class="form-group">
            <label class="form-label">目标描述</label>
            <textarea class="form-textarea" onchange="updateActionProperty('goal', this.value)">${action.goal}</textarea>
          </div>
        </div>
      `;
      break;
  }

  container.innerHTML = html;
}

// 更新操作属性
function updateActionProperty(property, value) {
  if (selectedAction !== null) {
    if (property.includes('.')) {
      // 嵌套属性
      const parts = property.split('.');
      sequence[selectedAction][parts[0]][parts[1]] = value;
    } else {
      sequence[selectedAction][property] = value;
    }
    renderSequence();
    updateStatus();
  }
}

// 上移操作
function moveUp(index) {
  if (index > 0) {
    [sequence[index], sequence[index - 1]] = [sequence[index - 1], sequence[index]];
    renderSequence();
    updateStatus();
  }
}

// 下移操作
function moveDown(index) {
  if (index < sequence.length - 1) {
    [sequence[index], sequence[index + 1]] = [sequence[index + 1], sequence[index]];
    renderSequence();
    updateStatus();
  }
}

// 复制操作
function duplicateAction(index) {
  const action = JSON.parse(JSON.stringify(sequence[index]));
  action.id = Date.now() + Math.random();
  sequence.splice(index + 1, 0, action);
  renderSequence();
  updateStatus();
}

// 删除操作
function deleteAction(index) {
  if (confirm('确定要删除这个操作吗？')) {
    sequence.splice(index, 1);
    selectedAction = null;
    renderSequence();
    updateStatus();
    document.getElementById('propertiesContent').innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-state-icon" style="font-size: 48px;">📝</div>
        <div class="empty-state-text" style="font-size: 16px;">选择一个操作</div>
        <div class="empty-state-hint">点击左侧操作查看属性</div>
      </div>
    `;
  }
}

// 清空序列
function clearSequence() {
  if (confirm('确定要清空所有操作吗？')) {
    sequence = [];
    selectedAction = null;
    renderSequence();
    updateStatus();
  }
}

// 运行序列
async function playSequence() {
  if (sequence.length === 0) {
    alert('请先添加操作');
    return;
  }

  if (isPlaying) {
    alert('序列正在运行中');
    return;
  }

  isPlaying = true;

  try {
    // 发送到后端执行
    const response = await fetch('/api/execute-sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence })
    });

    const result = await response.json();

    if (result.success) {
      alert('序列执行完成！');
    } else {
      alert(`执行失败：${result.error}`);
    }
  } catch (error) {
    alert(`执行错误：${error.message}`);
  } finally {
    isPlaying = false;
  }
}

// 停止序列
function stopSequence() {
  if (!isPlaying) {
    return;
  }

  fetch('/api/stop-sequence', { method: 'POST' })
    .then(() => {
      isPlaying = false;
      alert('已停止执行');
    })
    .catch(error => {
      alert(`停止失败：${error.message}`);
    });
}

// 保存序列
function saveSequence() {
  if (sequence.length === 0) {
    alert('请先添加操作');
    return;
  }

  document.getElementById('saveModal').classList.add('active');
}

// 确认保存
async function confirmSave() {
  const name = document.getElementById('sequenceName').value.trim();
  const description = document.getElementById('sequenceDescription').value.trim();

  if (!name) {
    alert('请输入序列名称');
    return;
  }

  try {
    const response = await fetch('/api/save-sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        sequence
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('保存成功！');
      closeSaveModal();
      updateStatus();
    } else {
      alert(`保存失败：${result.error}`);
    }
  } catch (error) {
    alert(`保存错误：${error.message}`);
  }
}

// 关闭保存模态框
function closeSaveModal() {
  document.getElementById('saveModal').classList.remove('active');
  document.getElementById('sequenceName').value = '';
  document.getElementById('sequenceDescription').value = '';
}

// 加载序列
async function loadSequence() {
  try {
    const response = await fetch('/api/list-sequences');
    const result = await response.json();

    if (result.success) {
      showSequenceList(result.sequences);
    } else {
      alert(`加载失败：${result.error}`);
    }
  } catch (error) {
    alert(`加载错误：${error.message}`);
  }
}

// 显示序列列表
function showSequenceList(sequences) {
  const listContainer = document.getElementById('sequenceList');

  if (sequences.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <div class="empty-state-text">暂无保存的序列</div>
      </div>
    `;
  } else {
    listContainer.innerHTML = sequences.map(seq => `
      <div class="property-group" style="cursor: pointer;" onclick="loadSequenceById('${seq.id}')">
        <h4>${seq.name}</h4>
        <p style="font-size: 14px; color: #666; margin-top: 5px;">${seq.description || '无描述'}</p>
        <p style="font-size: 12px; color: #999; margin-top: 5px;">
          ${seq.actionCount} 个操作 | ${new Date(seq.createdAt).toLocaleString()}
        </p>
      </div>
    `).join('');
  }

  document.getElementById('loadModal').classList.add('active');
}

// 根据ID加载序列
async function loadSequenceById(id) {
  try {
    const response = await fetch(`/api/load-sequence/${id}`);
    const result = await response.json();

    if (result.success) {
      sequence = result.sequence;
      renderSequence();
      updateStatus();
      closeLoadModal();
      alert('加载成功！');
    } else {
      alert(`加载失败：${result.error}`);
    }
  } catch (error) {
    alert(`加载错误：${error.message}`);
  }
}

// 关闭加载模态框
function closeLoadModal() {
  document.getElementById('loadModal').classList.remove('active');
}

// 加载已保存的序列列表
function loadSavedSequences() {
  // 初始化时加载
}

// 更新状态栏
function updateStatus() {
  document.getElementById('actionCount').textContent = sequence.length;

  // 计算预计时长
  let totalTime = 0;
  sequence.forEach(action => {
    if (action.type === 'wait') {
      totalTime += action.duration;
    } else if (action.type === 'type') {
      totalTime += action.text.length * action.delay;
    } else {
      totalTime += 100; // 默认操作时间
    }
  });

  document.getElementById('estimatedTime').textContent = (totalTime / 1000).toFixed(1) + 's';
  document.getElementById('savedStatus').textContent = '否';
}