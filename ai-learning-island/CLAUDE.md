# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 技术栈
- **后端**: Python 3.11 / FastAPI (conda env: `education`)
- **前端**: HTML5 Canvas + 原生 JS（无框架）
- **数据库**: MySQL 8 (aiomysql)
- **TTS**: MiniMax Token Plan API
- **手柄**: Gamepad API

## 启动（从项目根目录执行）
```bash
conda activate education
source ../education_config.sh           # ../ 相对于项目根目录 education/
cd ai-learning-island/backend && python3 main.py
# 服务运行在 http://localhost:8000
```

## 数据库 (MySQL)
- 数据库: `education`，用户: `education_admin`
- 配置通过 `education_config.sh` 环境变量注入（不写入代码）
- 启动时自动建表（7 张表）
- 已有数据库会自动迁移添加新字段（`username`, `password_hash`）

### 7 张表
| 表名 | 说明 |
|------|------|
| `child_profile` | 用户档案（含 username/password_hash 认证字段） |
| `auth_tokens` | 登录 token 表（64位 hex token → profile_id） |
| `dudu_state` | 嘟嘟伙伴状态（心情/亲密度/装饰） |
| `memory_events` | 嘟嘟记忆事件（L1 情境记忆） |
| `session_records` | 学习会话记录 |
| `math_levels` | 数学知识点等级 |
| `wrong_answers` | 错题本 |

## 敏感信息
- API Key 和数据库密码存储在项目根目录同级的 `education_config.sh`
- 不要将任何密钥提交到 Git 仓库
- 用户密码使用 SHA-256 哈希存储（`backend/auth.py`）

## 架构概览

### 目录结构
```
ai-learning-island/
├── backend/
│   ├── main.py            # FastAPI 应用 + 所有 API 路由
│   ├── database.py        # MySQL 连接池 + 初始化建表
│   ├── auth.py            # 认证模块（密码哈希/token/current_user dependency）
│   ├── dialogue_engine.py # 嘟嘟对话逻辑
│   ├── tts_service.py     # MiniMax TTS 语音
│   └── models.py          # Pydantic 数据模型（含 LoginRequest/RegisterRequest）
├── frontend/
│   ├── index.html         # 入口（登录页 → 学科选择 → 路线图/答题/蘑菇屋/商店/报告）
│   ├── css/main.css       # 全局样式（1920×1080 电视大屏优化）
│   └── js/
│       ├── app.js         # 主逻辑：初始化、游戏循环、Canvas渲染、答题流程、登录/profile
│       ├── dialogue-ui.js # 嘟嘟对话UI + TTS音频队列
│       └── gamepad.js     # 手柄管理器
└── modules/               # 模块系统
    ├── number_sense/      # 数感启蒙 - ready
    ├── addition/          # 5以内加法 - ready
    ├── subtraction/       # 5以内减法 - ready
    ├── ten_complement/    # 凑十法 - ready
    ├── borrowing_sub/     # 破十法 - ready
    └── clock_time/        # 认识钟表 - planned
```

### 模块系统（核心设计）
**"配置即代码，目录即模块"**：每个知识点是 `modules/` 下的一个目录，通过 `config.json` 声明式挂载，路线图自动渲染。

每个模块的 `config.json`:
```json
{
  "id": "ten_complement",
  "name": "凑十法",
  "status": "ready",     // ready | developing | planned | draft
  "route": "sprout",     // 所属路线（sprout/valley/star/castle/dragon）
  "order": 4,            // 排序
  "entry": "/api/challenge/ten_complement"
}
```

### 认证系统
- 用户通过 `POST /api/auth/register` 或 `POST /api/auth/login` 获取 token（64位 hex）
- 前端将 token 存入 `localStorage`，所有 API 请求自动附加 `Authorization: Bearer <token>`
- 后端通过 `auth.get_current_user()` FastAPI Dependency 验证
- 首页加载时检测 localStorage token → 有效则跳过登录，无效则显示登录页
- `/api/profile` 等端点已改为返回当前 token 对应用户的数据

### 数据流
```
登录页 → 注册/登录 → localStorage 存 token
    ↓
学科选择页 → 选择数学大陆
    ↓
/api/modules  →  渲染路线图（按 route 分组，按 order 排序）
    ↓
用户点击模块卡片 → enterModule() → fetch /api/challenge/{id}
    ↓
答题完成 → 更新数学等级/水晶/错题本 → 结算 → 返回路线图
```

### 前端页面流
1. **登录页** (#login-page): 用户名+密码登录 / 注册，入口页面
2. **学科选择页** (#subject-select): v2.0 入口，展示数学/语文/英语三个学科卡片
3. **路线图** (#map-view): 从 `/api/modules` 获取模块列表，模块卡片（彩色/灰色/锁定）
4. **探索模式** (Canvas): 角色移动 + 谜题发现，旧版游戏循环
5. **答题模式**: 选择题 + 凑十法/破十法步骤教学动画
6. **结算/报告**: 学习报告、蘑菇屋装饰商店

### API 路由

| 端点 | 方法 | 说明 | 需认证 |
|------|------|------|--------|
| `/api/auth/register` | POST | 注册新用户 | - |
| `/api/auth/login` | POST | 登录 | - |
| `/api/auth/logout` | POST | 登出 | ✓ |
| `/api/auth/me` | GET | 当前用户信息 | ✓ |
| `/api/auth/change-password` | POST | 修改密码 | ✓ |
| `/api/profile` | GET/POST | 用户档案读写 | ✓ |
| `/api/modules` | GET | 所有模块（路线图数据源） | ✓ |
| `/api/modules/{id}` | GET | 单个模块详情 | ✓ |
| `/api/challenge/{module_id}` | GET | 获取模块题目（答案经验证） | ✓ |
| `/api/dudu` | GET | 嘟嘟状态 | ✓ |
| `/api/dudu/mood` | POST | 设置嘟嘟心情 | ✓ |
| `/api/dialogue` | POST | 嘟嘟对话生成 | ✓ |
| `/api/tts` | GET | 文本转语音 | ✓ |
| `/api/math-levels` | GET/POST | 数学等级数据 | ✓ |
| `/api/memories` | GET/POST | 记忆系统 | ✓ |
| `/api/sessions` | GET/POST | 学习记录 | ✓ |
| `/api/wrong-answers` | GET/POST | 错题本 | ✓ |
| `/api/memories/learning-insights` | GET | L2学习洞察 | ✓ |
| `/api/memories/similar-problem` | GET | 生成相似题 | ✓ |
| `/api/shop/items` | GET | 装饰商店列表 | ✓ |
| `/api/shop/buy` | POST | 购买装饰 | ✓ |
| `/api/dudu/friendship` | GET/POST | 嘟嘟亲密度 | ✓ |
| `/api/report` | GET | 家长报告 | ✓ |

## 题目生成与验证系统
- **静态模板**: 数感/图形/钟表/凑十法/破十法（答案固定，写在 `STATIC_PROBLEMS` 字典中）
- **动态生成器**: 加法/减法/代数思维（随机出题 + 同步计算答案）
- **选项生成** (`_gen_options`): 以正确答案为中心生成干扰项，确保正确答案始终在选项中
- **双重验证**: 生成后校验 `answer in options`，不通过则重新生成
- 核心实现在 `backend/main.py` 的 `generate_problems()` 函数

## 当前重构状态（v2.0 模块系统）
- ✅ 模块目录 + config.json（6个模块）
- ✅ `/api/modules` 后端端点
- ✅ 学科选择页 UI
- ✅ 路线图渲染
- ✅ 模块→答题直接跳转（`/api/challenge/{id}`）
- ✅ 题目验证系统
- ✅ 登录认证系统（注册/登录/登出/token 鉴权）
- ✅ 个人资料编辑面板（HUD 按钮 → 编辑名字/年龄/密码）
