/**
 * 数学魔法岛 — v2.0 完整游戏循环
 * 探索模式：Canvas + 手柄移动 + 发现谜题
 * 挑战模式：答题 + 嘟嘟反馈
 */

const API_BASE = '/api';

// ===== 全局状态 =====

const state = {
  scene: 'loading',             // loading | greeting | exploring | challenge | summary | goodbye
  profile: null,
  duduState: null,
  problems: [],
  problemIndex: 0,
  stats: { attempted: 0, correct: 0 },
  playerX: 0,                   // 探索模式角色位置
  playerY: 0,
  sparkles: [],                 // 地图上的谜题点 [{x, y, solved}]
  sparkleIndex: 0,
  exploring: false,
  moveDir: { x: 0, y: 0 },    // 当前移动方向
  turnMode: 'child',            // 'parent' | 'child'
  _greetingStarted: false,      // 是否已开始打招呼（确保音频在用户交互后播放）
};

const gamepad = new GamepadManager();
const dialogue = new DialogueUI();

// ===== 区域配置 =====

const ZONE_ORDER = ['number_meadow', 'addition_forest', 'subtraction_cave'];

const ZONE_NAMES = {
  number_meadow: '数字草原',
  addition_forest: '加法森林',
  subtraction_cave: '减法山洞',
};

const ZONE_DEFAULT_TOPIC = {
  number_meadow: '数感',
  addition_forest: '凑十法',
  subtraction_cave: '破十法',
};

const ZONE_CONFIG = {
  number_meadow: {
    name: '数字草原',
    emoji: '🌿',
    sparkles: [
      { x: 0.18, y: 0.78, label: '数字精灵', icon: '🌟' },
      { x: 0.38, y: 0.82, label: '数字排队', icon: '🔢' },
      { x: 0.58, y: 0.75, label: '水晶初现', icon: '💎' },
      { x: 0.75, y: 0.80, label: '数字桥', icon: '🌉' },
      { x: 0.50, y: 0.68, label: '草原守护者', icon: '🏰' },
    ],
    problems: [
      [
        { q: '数一数：🌺 🌺 🌺 一共有几朵花？', a: 3, opts: [1, 2, 3, 4], topic: '数感' },
        { q: '数一数：🍄 🍄 🍄 🍄 一共有几个蘑菇？', a: 4, opts: [2, 3, 4, 5], topic: '数感' },
      ],
      [
        { q: '比大小：5 和 3，哪个更大？', a: 5, opts: [2, 3, 4, 5], topic: '数感' },
        { q: '比大小：2 和 7，哪个更大？', a: 7, opts: [4, 5, 6, 7], topic: '数感' },
      ],
      [
        { q: '嘟嘟有 2 颗水晶，又找到 1 颗，一共几颗？', a: 3, opts: [1, 2, 3, 4], topic: '加法' },
        { q: '1 + 3 = ?', a: 4, opts: [2, 3, 4, 5], topic: '加法' },
      ],
      [
        { q: '3 + 4 = ?', a: 7, opts: [5, 6, 7, 8], topic: '加法' },
        { q: '8 - 2 = ?', a: 6, opts: [4, 5, 6, 7], topic: '减法' },
      ],
      [
        { q: '5 + 5 = ?', a: 10, opts: [8, 9, 10, 11], topic: '加法' },
        { q: '从1到10，第7个数是几？', a: 7, opts: [5, 6, 7, 8], topic: '数感' },
        { q: '嘟嘟有5颗水晶，给了2颗给朋友，还剩几颗？', a: 3, opts: [2, 3, 4, 5], topic: '减法' },
      ],
    ],
  },
  addition_forest: {
    name: '加法森林',
    emoji: '🌳',
    sparkles: [
      { x: 0.20, y: 0.80, label: '凑十魔法', icon: '🔟' },
      { x: 0.40, y: 0.84, label: '加法树', icon: '🌳' },
      { x: 0.60, y: 0.77, label: '森林谜题', icon: '🦊' },
      { x: 0.48, y: 0.70, label: '加法Boss', icon: '👑' },
    ],
    problems: [
      [
        { q: '7 + □ = 10，□ 是几？', a: 3, opts: [1, 2, 3, 4], topic: '凑十法' },
        { q: '嘟嘟有6颗松果，还需要几颗才能凑到10颗？', a: 4, opts: [2, 3, 4, 5], topic: '凑十法' },
      ],
      [
        { q: '8 + 5 = ? 用凑十法想一想~', a: 13, opts: [11, 12, 13, 14], topic: '凑十法',
          steps: ['8 + 5 = ？', '把5分成2和3，先凑10', '8 + 2 = 10，10 + 3 = 13！'] },
        { q: '7 + 6 = ?', a: 13, opts: [11, 12, 13, 14], topic: '凑十法',
          steps: ['7 + 6 = ？', '把6分成3和3，先凑10', '7 + 3 = 10，10 + 3 = 13！'] },
      ],
      [
        { q: '树上有9只鸟，又飞来6只，一共几只？', a: 15, opts: [13, 14, 15, 16], topic: '凑十法',
          steps: ['9 + 6 = ？', '把6分成1和5，先凑10', '9 + 1 = 10，10 + 5 = 15！'] },
        { q: '8 + 7 = ?', a: 15, opts: [12, 13, 14, 15], topic: '凑十法',
          steps: ['8 + 7 = ？', '把7分成2和5，先凑10', '8 + 2 = 10，10 + 5 = 15！'] },
      ],
      [
        { q: '9 + 5 = ?', a: 14, opts: [12, 13, 14, 15], topic: '凑十法',
          steps: ['9 + 5 = ？', '把5分成1和4，先凑10', '9 + 1 = 10，10 + 4 = 14！'] },
        { q: '6 + 8 = ?', a: 14, opts: [12, 13, 14, 15], topic: '凑十法',
          steps: ['6 + 8 = ？', '把8分成4和4，先凑10', '6 + 4 = 10，10 + 4 = 14！'] },
        { q: '7 + 9 = ?', a: 16, opts: [14, 15, 16, 17], topic: '凑十法',
          steps: ['7 + 9 = ？', '把9分成3和6，先凑10', '7 + 3 = 10，10 + 6 = 16！'] },
      ],
    ],
  },
  subtraction_cave: {
    name: '减法山洞',
    emoji: '🕳️',
    sparkles: [
      { x: 0.22, y: 0.82, label: '减法入口', icon: '🚪' },
      { x: 0.42, y: 0.79, label: '破十魔法', icon: '💫' },
      { x: 0.62, y: 0.83, label: '山洞探险', icon: '🦇' },
      { x: 0.52, y: 0.72, label: '减法Boss', icon: '🐉' },
    ],
    problems: [
      [
        { q: '10 - 4 = ?', a: 6, opts: [4, 5, 6, 7], topic: '破十法' },
        { q: '9 - 3 = ?', a: 6, opts: [3, 5, 6, 8], topic: '破十法' },
      ],
      [
        { q: '15 - 8 = ? 用破十法试一试！', a: 7, opts: [5, 6, 7, 8], topic: '破十法',
          steps: ['15 - 8 = ？', '把15分成10和5', '10 - 8 = 2，2 + 5 = 7！'] },
        { q: '13 - 6 = ?', a: 7, opts: [5, 6, 7, 8], topic: '破十法',
          steps: ['13 - 6 = ？', '把13分成10和3', '10 - 6 = 4，4 + 3 = 7！'] },
      ],
      [
        { q: '16 - 9 = ?', a: 7, opts: [6, 7, 8, 9], topic: '破十法',
          steps: ['16 - 9 = ？', '把16分成10和6', '10 - 9 = 1，1 + 6 = 7！'] },
        { q: '12 - 7 = ?', a: 5, opts: [3, 4, 5, 6], topic: '破十法',
          steps: ['12 - 7 = ？', '把12分成10和2', '10 - 7 = 3，3 + 2 = 5！'] },
      ],
      [
        { q: '14 - 8 = ?', a: 6, opts: [4, 5, 6, 7], topic: '破十法',
          steps: ['14 - 8 = ？', '把14分成10和4', '10 - 8 = 2，2 + 4 = 6！'] },
        { q: '17 - 9 = ?', a: 8, opts: [6, 7, 8, 9], topic: '破十法',
          steps: ['17 - 9 = ？', '把17分成10和7', '10 - 9 = 1，1 + 7 = 8！'] },
        { q: '11 - 5 = ?', a: 6, opts: [4, 5, 6, 7], topic: '破十法',
          steps: ['11 - 5 = ？', '把11分成10和1', '10 - 5 = 5，5 + 1 = 6！'] },
      ],
    ],
  },
};

// ===== 区域辅助函数 =====

function getCurrentZone() {
  return state.profile?.current_zone || 'number_meadow';
}

function getZoneConfig() {
  return ZONE_CONFIG[getCurrentZone()] || ZONE_CONFIG.number_meadow;
}

function getCurrentSparkles() {
  return getZoneConfig().sparkles;
}

function getCurrentProblems() {
  return getZoneConfig().problems;
}

function getZoneDefaultTopic() {
  return ZONE_DEFAULT_TOPIC[getCurrentZone()] || '数感';
}

// ===== 初始化 =====

async function init() {
  console.log('🌟 数学魔法岛 v2.0 启动');

  gamepad.start();
  gamepad.on('press', onButtonPress);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  await loadProfile();
  await loadDuduState();

  initCanvas();
  startGameLoop();
  updateHUD();

  document.getElementById('loading-overlay').classList.add('fade-out');
  // 先显示学科选择页面（v2.0）
  showSubjectSelect();
}


// ===== 学科选择 v2.0 =====

const ROUTE_NAMES = {
  sprout: '🌱 萌芽森林',
  valley: '🧭 智慧山谷',
  star: '🔮 星辰原野',
  castle: '🏰 几何城堡',
  dragon: '🐉 挑战龙穴',
};

function showSubjectSelect() {
  document.getElementById('subject-select').classList.remove('hidden');
  document.getElementById('start-hint').classList.add('hidden');
}

function selectSubject(subject) {
  if (subject === 'math') {
    showModuleMap();
  }
}

async function showModuleMap() {
  const modules = await apiGet('/modules');
  renderModuleMap(modules);
  document.getElementById('subject-select').classList.add('hidden');
  document.getElementById('map-view').classList.remove('hidden');
}

function renderModuleMap(modules) {
  const container = document.getElementById('module-list');

  // 按 route 分组
  const groups = {};
  modules.forEach(m => {
    const route = m.route || 'sprout';
    if (!groups[route]) groups[route] = [];
    groups[route].push(m);
  });

  // 如果只有一个 route，用 route 名作为标题
  const routes = Object.keys(groups);
  const titleEl = document.getElementById('map-title');
  if (routes.length === 1) {
    titleEl.textContent = ROUTE_NAMES[routes[0]] || '🗺️ 学习路线图';
  } else {
    titleEl.textContent = '🗺️ 学习大陆';
  }

  let html = '';
  routes.forEach(route => {
    const groupModules = groups[route];
    if (routes.length > 1) {
      html += `<div class="route-header">${ROUTE_NAMES[route] || route}</div>`;
    }
    groupModules.forEach(m => {
      const isLocked = !m.available && m.status !== 'planned';
      const isPlanned = m.status === 'planned';
      let cls = 'module-card';
      if (isLocked) cls += ' locked';
      if (isPlanned) cls += ' planned';

      html += `
        <div class="${cls}" data-id="${m.id}" onclick="enterModule('${m.id}')">
          <div class="module-icon">${isPlanned ? '⏳' : m.icon}</div>
          <div class="module-name">${m.name}</div>
          <div class="module-desc">${m.description || ''}</div>
          <div class="module-grade">${isPlanned ? '即将开放' : (m.grade === 0 ? '幼小衔接' : `${m.grade}年级`)}</div>
        </div>
      `;
    });
  });
  container.innerHTML = html;
}

async function enterModule(moduleId) {
  const card = document.querySelector(`[data-id="${moduleId}"]`);
  if (card?.classList.contains('locked')) return;

  console.log('进入模块:', moduleId);

  // 从API获取题目
  let challenge;
  try {
    challenge = await apiGet(`/challenge/${moduleId}`);
  } catch (e) {
    console.error('获取题目失败:', e);
    return;
  }

  if (!challenge.problems || challenge.problems.length === 0) {
    console.error('无可用题目');
    return;
  }

  // 切换到模块答题模式
  state.moduleMode = true;
  state.problems = challenge.problems;
  state.problemIndex = 0;
  state.stats = { attempted: 0, correct: 0 };
  state.scene = 'challenge';
  state._greetingStarted = true;  // 跳过初次引导

  // 隐藏地图，显示答题
  document.getElementById('map-view').classList.add('hidden');
  updateHUD();
  showNextProblem();
}

function showSubjectSelectFromMap() {
  document.getElementById('map-view').classList.add('hidden');
  showSubjectSelect();
}

// ===== API 调用 =====

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  return res.json();
}

async function apiPost(path, data = null) {
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
  if (data) opts.body = JSON.stringify(data);
  return (await fetch(API_BASE + path, opts)).json();
}

async function loadProfile() {
  state.profile = await apiGet('/profile') || {};
  state.profile.name = state.profile.name || '';
  state.profile.crystals = state.profile.crystals || 0;
  state.profile.streak_days = state.profile.streak_days || 0;
  state.profile.current_zone = state.profile.current_zone || 'number_meadow';
  state.profile.current_level = state.profile.current_level || 1;
}

async function loadDuduState() {
  state.duduState = await apiGet('/dudu') || {};
}

async function getDialogue(scene, extra = {}) {
  return await apiPost('/dialogue', {
    scene,
    child_name: state.profile.name,
    zone: (state.profile ? getZoneConfig().name : ''),
    ...extra,
  });
}

function updateHUD() {
  document.getElementById('crystal-count').textContent = `💎 ${state.profile.crystals || 0}`;
  document.getElementById('streak-days').textContent = `🔥 ${(state.profile.streak_days || 0)}天`;
  const currentConfig = getZoneConfig();
  document.getElementById('zone-name').textContent =
    state.scene === 'exploring' ? currentConfig.emoji + ' ' + currentConfig.name : '🏠 蘑菇屋';
  updateFriendshipBadge();
}

async function updateFriendshipBadge() {
  try {
    const f = await apiGet('/dudu/friendship');
    document.getElementById('friendship-badge').textContent = `🤝 ${f.name}`;
  } catch (e) {}
}

// ===== Canvas 渲染 =====

let canvas, ctx;

function initCanvas() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function drawBackground() {
  const zone = getCurrentZone();
  const t = Date.now();

  // 天空渐变 — 区域差异
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (zone === 'addition_forest') {
    sky.addColorStop(0, '#3d1f00');
    sky.addColorStop(0.5, '#6b3a1f');
    sky.addColorStop(1, '#2d4a20');
  } else if (zone === 'subtraction_cave') {
    sky.addColorStop(0, '#0a0a2e');
    sky.addColorStop(0.5, '#1a1a4e');
    sky.addColorStop(1, '#1a2a3a');
  } else {
    sky.addColorStop(0, '#1a0533');
    sky.addColorStop(0.5, '#2d1b4e');
    sky.addColorStop(1, '#1a3a2a');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 星星（全区域通用）
  for (let i = 0; i < 60; i++) {
    const x = (i * 137 + 53) % canvas.width;
    const y = (i * 89 + 27) % (canvas.height * 0.55);
    ctx.globalAlpha = 0.2 + Math.sin(t * 0.001 + i * 0.7) * 0.3 + 0.3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 地面 — 区域差异
  const ground = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
  if (zone === 'addition_forest') {
    ground.addColorStop(0, '#8a6b2a');
    ground.addColorStop(0.3, '#6b5020');
    ground.addColorStop(1, '#4a3515');
  } else if (zone === 'subtraction_cave') {
    ground.addColorStop(0, '#4a4a5a');
    ground.addColorStop(0.3, '#3a3a4a');
    ground.addColorStop(1, '#2a2a3a');
  } else {
    ground.addColorStop(0, '#3d7a37');
    ground.addColorStop(0.3, '#2d5a27');
    ground.addColorStop(1, '#1a3a15');
  }
  ctx.fillStyle = ground;
  ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);

  // 地面纹理
  const texColor = zone === 'addition_forest' ? '#9a7b3a'
    : zone === 'subtraction_cave' ? '#5a5a6a' : '#4a9a44';
  ctx.fillStyle = texColor;
  for (let i = 0; i < 200; i++) {
    const gx = (i * 173 + 11) % canvas.width;
    const gy = canvas.height * 0.7 + (i * 97 + 7) % (canvas.height * 0.1);
    ctx.fillRect(gx, gy, 2, 8 + (i % 5));
  }

  // 装饰 — 区域差异
  if (zone === 'addition_forest') {
    drawTree(ctx, canvas.width * 0.05, canvas.height * 0.62, 80);
    drawTree(ctx, canvas.width * 0.12, canvas.height * 0.66, 60);
    drawTree(ctx, canvas.width * 0.88, canvas.height * 0.60, 90);
    drawTree(ctx, canvas.width * 0.95, canvas.height * 0.65, 60);
    drawTree(ctx, canvas.width * 0.30, canvas.height * 0.80, 35);
    drawTree(ctx, canvas.width * 0.72, canvas.height * 0.82, 40);
    drawMushroom(ctx, canvas.width * 0.50, canvas.height * 0.84, 16, '#ffd93d');
    drawMushroom(ctx, canvas.width * 0.68, canvas.height * 0.80, 14, '#ff6b6b');
    drawHouse(ctx, canvas.width * 0.45, canvas.height * 0.55, 90);
    drawFireflies(t);
  } else if (zone === 'subtraction_cave') {
    drawCaveEntrance(ctx, canvas.width * 0.42, canvas.height * 0.55, 80);
    drawTree(ctx, canvas.width * 0.07, canvas.height * 0.64, 50);
    drawTree(ctx, canvas.width * 0.92, canvas.height * 0.63, 45);
    drawHouse(ctx, canvas.width * 0.45, canvas.height * 0.55, 70);
    drawCrystalLights(t);
  } else {
    drawTree(ctx, canvas.width * 0.08, canvas.height * 0.65, 60);
    drawTree(ctx, canvas.width * 0.9, canvas.height * 0.62, 50);
    drawMushroom(ctx, canvas.width * 0.25, canvas.height * 0.82, 22, '#ff6b6b');
    drawMushroom(ctx, canvas.width * 0.65, canvas.height * 0.78, 18, '#ffd93d');
    drawMushroom(ctx, canvas.width * 0.8, canvas.height * 0.84, 20, '#ff9ecf');
    drawHouse(ctx, canvas.width * 0.45, canvas.height * 0.55, 90);
  }

  // 路标
  ctx.fillStyle = '#8B7355';
  ctx.fillRect(canvas.width * 0.05, canvas.height * 0.68, 6, 50);
  ctx.fillStyle = '#DEB887';
  ctx.fillRect(canvas.width * 0.03, canvas.height * 0.68, 30, 20);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(ZONE_NAMES[zone] + ' →', canvas.width * 0.04, canvas.height * 0.66);
}

// ===== 区域专属渲染辅助 =====

function drawFireflies(t) {
  for (let i = 0; i < 15; i++) {
    const fx = ((i * 137 + 53 + t * 0.01 * (i + 1)) % canvas.width);
    const fy = canvas.height * 0.62 + ((i * 89 + 27 + Math.sin(t * 0.002 + i) * 20) % (canvas.height * 0.25));
    const glow = Math.sin(t * 0.005 + i * 2.3) * 0.3 + 0.7;
    ctx.globalAlpha = glow * 0.6;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(fx, fy, 2 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCaveEntrance(cx, cy, size) {
  ctx.fillStyle = '#2a1a1a';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.7, cy);
  ctx.lineTo(cx - size * 0.6, cy - size * 0.2);
  ctx.quadraticCurveTo(cx, cy - size * 0.7, cx + size * 0.6, cy - size * 0.2);
  ctx.lineTo(cx + size * 0.7, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.45, cy);
  ctx.lineTo(cx - size * 0.35, cy - size * 0.1);
  ctx.quadraticCurveTo(cx, cy - size * 0.45, cx + size * 0.35, cy - size * 0.1);
  ctx.lineTo(cx + size * 0.45, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b388ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.6, cy - size * 0.2);
  ctx.quadraticCurveTo(cx, cy - size * 0.7, cx + size * 0.6, cy - size * 0.2);
  ctx.stroke();
}

function drawCrystalLights(t) {
  const crystals = [
    { x: 0.15, y: 0.70 }, { x: 0.85, y: 0.72 },
    { x: 0.35, y: 0.82 }, { x: 0.70, y: 0.80 },
  ];
  crystals.forEach((c, i) => {
    const cx = c.x * canvas.width;
    const cy = c.y * canvas.height;
    const glow = Math.sin(t * 0.003 + i * 1.7) * 0.3 + 0.7;
    ctx.globalAlpha = glow * 0.3;
    ctx.fillStyle = '#b388ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#b388ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 6, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx - 3, cy);
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawTree(cx, cy, size) {
  ctx.fillStyle = '#5D3A1A';
  ctx.fillRect(cx - size * 0.08, cy, size * 0.16, size * 0.5);
  ctx.fillStyle = '#2d7a27';
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.1, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d9a37';
  ctx.beginPath();
  ctx.arc(cx - size * 0.15, cy - size * 0.05, size * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawMushroom(cx, cy, size, color) {
  ctx.fillStyle = '#f5e6d3';
  ctx.fillRect(cx - size * 0.12, cy, size * 0.24, size * 0.55);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.42, size * 0.3, 0, Math.PI, 0);
  ctx.fill();
  // 斑点
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + (i - 1) * size * 0.15, cy - size * 0.1, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHouse(cx, cy, size) {
  ctx.fillStyle = '#f5e6d3';
  ctx.fillRect(cx - size * 0.45, cy, size * 0.9, size);
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.6, cy);
  ctx.lineTo(cx, cy - size * 0.65);
  ctx.lineTo(cx + size * 0.6, cy);
  ctx.fill();
  ctx.fillStyle = '#6B3A2A';
  ctx.fillRect(cx - size * 0.12, cy + size * 0.35, size * 0.24, size * 0.65);
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(cx - size * 0.28, cy + size * 0.25, size * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + size * 0.28, cy + size * 0.25, size * 0.12, 0, Math.PI * 2); ctx.fill();
}

function drawSparkles() {
  if (state.scene !== 'exploring') return;
  const t = Date.now();

  state.sparkles.forEach((s, i) => {
    if (s.solved) {
      // 已解决 → 小花朵
      ctx.font = '36px sans-serif';
      ctx.fillText('🌸', s.x * canvas.width - 18, s.y * canvas.height - 18);
      return;
    }
    // 闪光动画
    const glow = Math.sin(t * 0.004 + i * 1.5) * 0.4 + 0.6;
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(s.x * canvas.width, s.y * canvas.height, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 图标
    ctx.font = '40px sans-serif';
    ctx.fillText(s.icon || '✨', s.x * canvas.width - 20, s.y * canvas.height + 14);

    // 标签
    ctx.font = '18px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, s.x * canvas.width, s.y * canvas.height - 40);
    ctx.textAlign = 'start';
  });
}

function drawPlayer() {
  if (state.scene !== 'exploring') return;
  const px = state.playerX * canvas.width;
  const py = state.playerY * canvas.height;

  // 光晕
  ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
  ctx.beginPath();
  ctx.arc(px, py, 30, 0, Math.PI * 2);
  ctx.fill();

  // 角色（简单的精灵球）
  ctx.fillStyle = '#ff9ecf';
  ctx.beginPath();
  ctx.arc(px, py, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 方向指示
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px + 6, py - 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(px + 7, py - 4, 2, 0, Math.PI * 2);
  ctx.fill();

  // 标签
  ctx.font = '18px "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('👨‍👧 探险队', px, py - 35);
  ctx.textAlign = 'start';
}

function checkSparkleProximity() {
  for (let i = 0; i < state.sparkles.length; i++) {
    const s = state.sparkles[i];
    if (s.solved) continue;
    const dx = state.playerX - s.x;
    const dy = state.playerY - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.06) {
      state.sparkleIndex = i;
      discoverSparkle(i);
      return;
    }
  }
}

// ===== 游戏主循环 =====

function startGameLoop() {
  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }
  loop();
}

function update() {
  if (!state.exploring) return;

  // 移动
  const speed = 0.004;
  let dx = state.moveDir.x * speed;
  let dy = state.moveDir.y * speed;

  if (dx !== 0 || dy !== 0) {
    // 对角移动时标准化
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }
    state.playerX = Math.max(0.03, Math.min(0.97, state.playerX + dx));
    state.playerY = Math.max(0.62, Math.min(0.92, state.playerY + dy));
    checkSparkleProximity();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawSparkles();
  drawPlayer();
}

// ===== 对话流程 =====

async function startGreeting() {
  state.scene = 'greeting';
  dialogue.updateZone('蘑菇屋');

  const isFirstTime = !state.profile.name;
  const scene = isFirstTime ? 'greeting_first_time' : 'greeting_return';
  const result = await getDialogue(scene, { streak: state.profile.streak_days });

  await showDialogue(result);
  if (isFirstTime) {
    await askName();
  }
  await recallAndExplore();
}

function showDialogue(result) {
  return new Promise(resolve => {
    if (state.scene === 'exploring') dialogue.container.classList.remove('hidden');
    dialogue.show(result.text, result.mood, result.animation, resolve);
  });
}

async function askName() {
  const name = prompt('嘟嘟想知道你的名字～（输入你的小名吧）', '乐乐') || '小朋友';
  state.profile.name = name;
  await apiPost('/profile', state.profile);
  await apiPost('/memories?event_type=first_meeting', { event_data: { name } });

  const result = await getDialogue('greeting_return', {});
  await showDialogue(result);
}

async function recallAndExplore() {
  // 获取学习洞察（L2记忆）
  let insights = null;
  try { insights = await apiGet('/memories/learning-insights'); } catch (e) {}

  state.repeatTopics = insights?.repeat_topics || [];
  const trend = insights?.accuracy_trend;
  const duduMemories = insights?.dudu_memories || [];

  // 根据记忆选择个性化对话
  let scene = 'recall_yesterday';
  let topic = getZoneDefaultTopic();

  if (state.repeatTopics.length > 0) {
    topic = state.repeatTopics[0];
    scene = 'recall_struggle_repeat';
  } else if (trend === 'improving') {
    scene = 'recall_progress';
    topic = getZoneDefaultTopic();
  }

  const result = await getDialogue(scene, { topic });
  await showDialogue(result);

  startExploreMode();
}

// ===== 探索模式 =====

function startExploreMode() {
  state.scene = 'exploring';
  state.exploring = true;
  state.playerX = 0.12;
  state.playerY = 0.82;
  state.sparkles = getCurrentSparkles().map(s => ({ ...s, solved: false }));
  state.problems = [];
  state.problemIndex = 0;
  state.stats = { attempted: 0, correct: 0 };
  state.turnMode = 'child';
  updateHUD();

  const zoneConfig = getZoneConfig();
  dialogue.show(
    `用方向键或者手柄在${zoneConfig.name}上走走吧！看到闪闪发光的地方就靠近它~`,
    'curious', 'look_around', null
  );
}

async function discoverSparkle(index) {
  state.exploring = false;
  const s = state.sparkles[index];
  state.turnMode = (index === getCurrentSparkles().length - 1) ? 'boss' : 'child';

  // 探索发现对话
  const result = await getDialogue('explore_discover', { topic: s.label });
  dialogue.show(result.text, result.mood, result.animation, null);
  await delay(1500);

  // 生成这个谜题的题目
  state.problems = generateSparkleProblems(index);
  state.problemIndex = 0;
  state.scene = 'challenge';

  if (state.turnMode === 'boss') {
    const bossResult = await getDialogue('boss_start', {});
    await showDialogue(bossResult);
  }

  showNextProblem();
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ===== 题目生成 =====

function generateSparkleProblems(sparkleIndex) {
  const pools = getCurrentProblems();
  const sparkles = getCurrentSparkles();
  const count = sparkleIndex === sparkles.length - 1 ? 3 : 2;
  const pool = pools[Math.min(sparkleIndex, pools.length - 1)];
  return pool.slice(0, count);
}


// ===== 答题流程 =====

async function showNextProblem() {
  if (state.problemIndex >= state.problems.length) {
    finishSparkle();
    return;
  }

  const p = state.problems[state.problemIndex];
  const panel = document.getElementById('challenge-panel');
  panel.classList.remove('hidden');

  // 记忆驱动鼓励（TTS 通过 playTTSAndWait 在外层调用，这里只显示文字）
  if (state.problemIndex === 0 && state.repeatTopics?.length > 0 && p.topic === state.repeatTopics[0]) {
    const encourageText = `💭 嘟嘟记得你上次在「${p.topic}」上努力过，这次一定会更好的！`;
    document.getElementById('challenge-feedback').textContent = encourageText;
    document.getElementById('challenge-feedback').className = 'warm show';
  } else {
    document.getElementById('challenge-feedback').textContent = '';
    document.getElementById('challenge-feedback').className = '';
  }

  document.getElementById('challenge-topic').textContent =
    `💡 ${p.topic} · 第${state.problemIndex + 1}/${state.problems.length}题`;

  // Boss模式标记
  const turnLabel = state.turnMode === 'boss'
    ? (state.problemIndex % 2 === 0 ? '👧 孩子回合 — 这题你来答！' : '👨 爸爸回合 — 给孩子做个榜样！')
    : '';
  document.getElementById('challenge-question').textContent =
    p.q + (turnLabel ? '\n' + turnLabel : '');

  const optsEl = document.getElementById('challenge-options');
  optsEl.innerHTML = '';
  shuffleArray(p.opts).forEach((v, i) => {
    const btn = document.createElement('div');
    btn.className = 'challenge-option';
    btn.textContent = v;
    btn.dataset.value = v;
    btn.addEventListener('click', async () => {
      if (state._answeringEnabled) await selectAnswer(v, p);
    });
    optsEl.appendChild(btn);
  });

  document.getElementById('challenge-feedback').textContent = '';
  document.getElementById('challenge-feedback').className = '';
  state._highlighted = 0;
  state._answeringEnabled = false;
  highlightOpt(0);

  // 步骤教学动画（凑十法/破十法）
  if (p.steps) {
    await showStepByStepAnimation(p.steps);
  }

  // 启用答题
  state._answeringEnabled = true;
}

function highlightOpt(idx) {
  state._highlighted = idx;
  document.querySelectorAll('.challenge-option').forEach((o, i) => o.classList.toggle('focused', i === idx));
}

// 凑十法/破十法步骤教学动画
async function showStepByStepAnimation(steps) {
  const fb = document.getElementById('challenge-feedback');
  for (let i = 0; i < steps.length; i++) {
    fb.textContent = '✨ ' + steps[i];
    fb.className = 'warm show';
    // 语音读出每一步教学文字，等播完再继续
    await dialogue.playTTSAndWait(steps[i]);
    if (i < steps.length - 1) {
      await delay(800);  // 给视觉留一点停留时间
    }
  }
}

async function selectAnswer(value, problem) {
  const correct = value === problem.a;
  state.stats.attempted++;
  if (correct) state.stats.correct++;

  // 视觉反馈
  document.querySelectorAll('.challenge-option').forEach(o => {
    o.classList.remove('focused');
    if (parseInt(o.dataset.value) === problem.a) o.classList.add('correct');
    if (parseInt(o.dataset.value) === value && !correct) o.classList.add('wrong');
  });

  // 答错时立即播放安慰音效（打断可能正在播放的TTS）
  if (!correct) {
    dialogue.playEffect('哎呀，没关系～');
  }

  // 更新后端
  await apiPost('/math-levels?topic=' + encodeURIComponent(problem.topic) + '&correct=' + correct);

  if (correct) {
    // 答对：正常奖励反馈
    const scene = (state.stats.correct >= 3 && state.stats.attempted === state.stats.correct)
      ? 'correct_streak_3' : 'correct_first_try';
    const result = await getDialogue(scene, { topic: problem.topic });

    // 显示水晶奖励动画
    dialogue.showAward();
    state.profile.crystals = (state.profile.crystals || 0) + 1;
    dialogue.updateCrystal(state.profile.crystals);

    showFeedback(result);
    await dialogue.playTTSAndWait(result.text);
    await delay(800);
    state.problemIndex++;
    showNextProblem();
  } else {
    // 答错：嘟嘟一起学机制
    await apiPost('/wrong-answers?topic=' + encodeURIComponent(problem.topic)
      + '&question=' + encodeURIComponent(problem.q)
      + '&correct_answer=' + problem.a + '&child_answer=' + value);

    // 第1步：嘟嘟也困惑（等语音播完再继续）
    const duduResult = await getDialogue('wrong_teach_dudu', { topic: problem.topic });
    showFeedback(duduResult);
    await dialogue.playTTSAndWait(duduResult.text);

    // 第2步：显示正确答案 + "孩子教嘟嘟"提示
    const correctText = `正确答案是 ${problem.a} 哦~ ${state.profile.name}，你来教教嘟嘟吧！按 A 键继续说~`;
    document.getElementById('challenge-feedback').textContent = correctText;
    document.getElementById('challenge-feedback').className = 'warm show';
    await dialogue.playTTSAndWait(`正确答案是${problem.a}哦，你来教教嘟嘟吧`);

    // 第3步：显示"教嘟嘟"后的鼓励
    const teachResult = await getDialogue('correct_after_teach', { topic: problem.topic });
    document.getElementById('challenge-feedback').textContent = teachResult.text;
    document.getElementById('challenge-feedback').className = 'proud show';
    document.getElementById('dudu-mood').textContent = '🤩';
    await dialogue.playTTSAndWait(teachResult.text);

    await delay(800);
    state.problemIndex++;
    showNextProblem();
  }
}

function showFeedback(result) {
  const fb = document.getElementById('challenge-feedback');
  fb.textContent = result.text;
  fb.className = result.mood + ' show';
  document.getElementById('dudu-mood').textContent =
    result.mood === 'correct_first_try' || result.mood === 'excited' ? '🤩' : '😟';
  // TTS 由调用方通过 dialogue.playTTSAndWait() 播放，此处不再单独播放
}

async function finishSparkle() {
  document.getElementById('challenge-panel').classList.add('hidden');
  document.getElementById('dudu-mood').textContent = '😊';

  // 模块答题模式：完成后回到路线图
  if (state.moduleMode) {
    await finishModuleChallenge();
    return;
  }

  // 标记已解决
  if (state.sparkleIndex < state.sparkles.length) {
    state.sparkles[state.sparkleIndex].solved = true;
  }

  // 保存记忆事件 — 记录本组题目表现
  const errors = state.stats.attempted - state.stats.correct;
  if (errors > 0) {
    try {
      const currentConfig = getZoneConfig();
      await apiPost('/memories?event_type=puzzle_struggle', {
        event_data: {
          zone: getCurrentZone(),
          attempts: state.stats.attempted,
          correct: state.stats.correct,
          sparkle: currentConfig.sparkles[state.sparkleIndex]?.label || 'unknown',
        }
      });
    } catch (e) {}
  }

  // 检查是否全部完成
  const allDone = state.sparkles.every(s => s.solved);

  if (allDone) {
    await finishSession();
  } else {
    // 继续探索
    state.scene = 'exploring';
    state.exploring = true;
    dialogue.show('还有更多闪闪发光的地方！继续探索吧~', 'happy', 'bounce', null);
  }
}

async function finishModuleChallenge() {
  // 保存学习记录
  await apiPost('/sessions?zone=module_' + state.problems[0]?.topic
    + '&problems_attempted=' + state.stats.attempted
    + '&problems_correct=' + state.stats.correct);

  // 更新水晶
  state.profile.crystals = (state.profile.crystals || 0) + state.stats.correct;
  await apiPost('/profile', state.profile);

  updateHUD();

  // 显示完成提示，等用户按键后回到路线图
  const msg = state.stats.correct >= state.stats.attempted * 0.7
    ? `🎉 太棒了！答对了 ${state.stats.correct}/${state.stats.attempted} 题！`
    : `💪 继续加油！答对了 ${state.stats.correct}/${state.stats.attempted} 题`;

  dialogue.show(msg, 'happy', 'sparkle', async () => {
    dialogue.hide();
    await returnToModuleMap();
  });
}

async function returnToModuleMap() {
  state.moduleMode = false;
  state.scene = 'map';
  const modules = await apiGet('/modules');
  renderModuleMap(modules);
  document.getElementById('map-view').classList.remove('hidden');
  document.getElementById('subject-select').classList.add('hidden');
}

async function finishSession() {
  state.scene = 'summary';
  state.exploring = false;
  const currentZoneId = getCurrentZone();

  // 保存记录
  await apiPost('/sessions?zone=' + encodeURIComponent(currentZoneId)
    + '&problems_attempted=' + state.stats.attempted
    + '&problems_correct=' + state.stats.correct);

  // 更新水晶
  state.profile.crystals = (state.profile.crystals || 0) + state.stats.correct;
  await apiPost('/profile', state.profile);

  // 保存L2记忆：本次会话表现
  try {
    await apiPost('/memories?event_type=session_complete', {
      event_data: {
        zone: currentZoneId,
        total_attempts: state.stats.attempted,
        total_correct: state.stats.correct,
        accuracy: state.stats.attempted > 0
          ? Math.round(state.stats.correct / state.stats.attempted * 100) : 0,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (e) {}

  updateHUD();

  // 结算
  const scene = state.stats.correct >= state.stats.attempted * 0.7 ? 'session_good' : 'session_encourage';
  const result = await getDialogue(scene, {
    total_problems: state.stats.attempted,
    correct_count: state.stats.correct,
  });
  await showDialogue(result);

  // 告别
  const bye = await getDialogue('goodbye', {});
  await showDialogue(bye);

  dialogue.hide();
  document.getElementById('challenge-panel').classList.add('hidden');

  // 更新亲密度
  try { await apiPost('/dudu/friendship'); } catch (e) {}
  updateHUD();

  // 区域解锁检查
  const currentIdx = ZONE_ORDER.indexOf(currentZoneId);
  if (currentIdx >= 0 && currentIdx < ZONE_ORDER.length - 1) {
    const nextZoneId = ZONE_ORDER[currentIdx + 1];
    const nextZone = ZONE_CONFIG[nextZoneId];
    state.profile.current_zone = nextZoneId;
    await apiPost('/profile', state.profile);
    dialogue.show(
      `🎉 恭喜解锁新区域：${nextZone.emoji} ${nextZone.name}！明天就可以去探险啦！`,
      'excited', 'sparkle', null
    );
    await delay(3000);
    dialogue.hide();
  }

  // 完成画面 — 含蘑菇屋和报告入口
  setTimeout(() => {
    dialogue.show(
      `🌟 今天的冒险结束啦！\n解了${state.stats.attempted}题，对了${state.stats.correct}题！\n按 M 键参观蘑菇屋 | 按 R 键看学习报告`,
      'proud', 'sparkle', null
    );
    state._summaryKeys = true;
  }, 500);
}

function showEndOptions() {
  if (!state._summaryKeys) return;
  state._summaryKeys = false;
  dialogue.show(
    `🌟 今天的冒险结束啦！\n解了${state.stats.attempted}题，对了${state.stats.correct}题！\n按 M 键参观蘑菇屋 | 按 R 键看学习报告`,
    'proud', 'sparkle', null
  );
}

// ===== 输入处理 =====

function onButtonPress(data) {
  // 第一次按键 → 开始打招呼
  if (!state._greetingStarted) {
    state._greetingStarted = true;
    document.getElementById('start-hint').classList.add('hidden');
    // 在用户手势同步阶段预热 AudioContext，确保后续 audio.play() 不会被浏览器阻止
    dialogue.wakeAudio();
    startGreeting();
    return;
  }

  if (dialogue.isTyping) {
    dialogue.skipTyping(dialogue.textEl.textContent);
    return;
  }
  if (dialogue.onComplete) {
    dialogue.complete();
    return;
  }

  if (state.scene === 'challenge') {
    if (data.button === 0 && state._answeringEnabled !== false) { // A
      const opt = document.querySelector('.challenge-option.focused');
      if (opt && state.problemIndex < state.problems.length) {
        selectAnswer(parseInt(opt.dataset.value), state.problems[state.problemIndex]);
      }
    }
    if (data.button === 12 && state._answeringEnabled !== false) highlightOpt(Math.max(0, state._highlighted - 1)); // UP
    if (data.button === 13 && state._answeringEnabled !== false) highlightOpt(Math.min(3, state._highlighted + 1)); // DOWN
  }

  if (state.scene === 'exploring' && data.button === 0) {
    checkSparkleProximity();
  }
}

function onKeyDown(e) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    onButtonPress({ button: 0 });
  }
  if (e.key === 'ArrowUp') { e.preventDefault(); state.moveDir.y = -1; onButtonPress({ button: 12 }); }
  if (e.key === 'ArrowDown') { e.preventDefault(); state.moveDir.y = 1; onButtonPress({ button: 13 }); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); state.moveDir.x = -1; }
  if (e.key === 'ArrowRight') { e.preventDefault(); state.moveDir.x = 1; }
}

function onKeyUp(e) {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { state.moveDir.y = 0; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { state.moveDir.x = 0; }
  // 蘑菇屋/报告快捷键
  if (state.scene === 'summary' || state.scene === 'goodbye') {
    if (e.key === 'm' || e.key === 'M') { openHouse(); }
    if (e.key === 'r' || e.key === 'R') { openReport(); }
  }
}

// ===== 蘑菇屋 =====

function openHouse() {
  if (state.scene === 'exploring') state.exploring = false;
  dialogue.hide();
  document.getElementById('challenge-panel').classList.add('hidden');
  const panel = document.getElementById('house-panel');
  panel.classList.remove('hidden');
  loadHouseDecor();
}

function closeHouse() {
  document.getElementById('house-panel').classList.add('hidden');
  if (state.scene === 'exploring') {
    state.exploring = true;
    dialogue.show('探索继续！还有未发现的谜题哦~', 'happy', 'bounce', null);
  } else if (state.scene === 'summary' || state.scene === 'goodbye') {
    showEndOptions();
  }
}

async function loadHouseDecor() {
  try {
    const dudu = await apiGet('/dudu');
    const decor = dudu.house_decorations || [];
    const acc = dudu.accessories || [];
    document.getElementById('house-decor-count').textContent = decor.length;
    document.getElementById('house-dudu-acc').textContent = '装扮: ' + (acc.length > 0 ? acc.length + '件' : '无');
    document.getElementById('house-decor-display').textContent = decor.length > 0 ? '🏠✨' : '🏠';
  } catch (e) {}
}

// ===== 商店 =====

async function openShop() {
  document.getElementById('house-panel').classList.add('hidden');
  const panel = document.getElementById('shop-panel');
  panel.classList.remove('hidden');
  document.getElementById('shop-balance').textContent = `余额: 💎 ${state.profile.crystals || 0}`;

  const items = await apiGet('/shop/items');
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'shop-item' + (item.owned ? ' owned' : '');
    div.innerHTML = `<span class="item-icon">${item.icon}</span>
      <div class="item-name">${item.name}</div>
      <div class="item-price">💎 ${item.price}</div>`;
    if (!item.owned) {
      div.addEventListener('click', () => buyItem(item.id));
    }
    grid.appendChild(div);
  });
}

function closeShop() {
  document.getElementById('shop-panel').classList.add('hidden');
  document.getElementById('house-panel').classList.remove('hidden');
  loadHouseDecor();
}

async function buyItem(itemId) {
  const res = await apiPost('/shop/buy?item_id=' + itemId);
  if (res.status === 'ok') {
    state.profile.crystals = res.crystals_left;
    document.getElementById('shop-balance').textContent = `余额: 💎 ${res.crystals_left}`;
    updateHUD();
    openShop(); // 刷新商店
  } else if (res.status === 'not_enough_crystals') {
    alert(`水晶不够！需要 💎${res.need}，你只有 💎${res.have}`);
  }
}

// ===== 家长报告 =====

async function openReport() {
  if (state.scene === 'exploring') state.exploring = false;
  dialogue.hide();
  document.getElementById('challenge-panel').classList.add('hidden');
  const panel = document.getElementById('report-panel');
  panel.classList.remove('hidden');

  const data = await apiGet('/report');

  // 摘要卡片
  const stats = [
    { label: '学习天数', value: data.total_sessions },
    { label: '总答题数', value: data.total_problems },
    { label: '正确率', value: data.overall_accuracy + '%' },
    { label: '连续天数', value: data.streak_days + '天' },
    { label: '水晶', value: '💎 ' + data.crystals },
    { label: '亲密度', value: data.friendship_name },
  ];
  document.getElementById('report-summary').innerHTML = stats.map(s =>
    `<div class="report-stat"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`
  ).join('');

  // 知识点
  const topics = data.topics || [];
  document.getElementById('report-topics').innerHTML = topics.map(t => `
    <div class="topic-bar">
      <span class="topic-name">${t.topic}</span>
      <span class="topic-fill" style="width:${Math.max(5, t.accuracy)}%"></span>
      <span class="topic-stats">Lv.${t.level} | ${t.accuracy}% (${t.correct}/${t.attempts})</span>
    </div>
  `).join('');

  // 薄弱点
  const weak = data.weak_topics || [];
  document.getElementById('report-weak').innerHTML = weak.length > 0
    ? weak.map(w => `<div class="weak-item">${w.topic} <span class="weak-count">${w.count}题</span></div>`).join('')
    : '<p style="opacity:0.5">还没有错题记录，继续加油！</p>';

  // 每日图表
  const daily = data.daily_history || [];
  const maxC = Math.max(1, ...daily.map(d => d.correct));
  document.getElementById('report-chart').innerHTML = daily.map(d => `
    <div class="chart-bar" style="height:${Math.max(15, d.correct / maxC * 150)}px">
      <span class="bar-value">${d.correct}</span>
      <span class="bar-date">${d.date.slice(5)}</span>
    </div>
  `).join('');
}

function closeReport() {
  document.getElementById('report-panel').classList.add('hidden');
  if (state.scene === 'exploring') {
    state.exploring = true;
    dialogue.show('继续探索吧~', 'happy', 'idle', null);
  } else if (state.scene === 'summary' || state.scene === 'goodbye') {
    showEndOptions();
  }
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== 启动 =====
window.addEventListener('DOMContentLoaded', init);
