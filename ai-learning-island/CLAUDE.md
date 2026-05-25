# 数学魔法岛 - 项目配置

## 技术栈
- **后端**: Python 3.11 / FastAPI (conda env: `education`)
- **前端**: HTML5 Canvas + 原生 JS（无框架）
- **数据库**: MySQL (aiomysql)
- **TTS**: MiniMax Token Plan API
- **手柄**: Gamepad API

## 启动（从项目根目录执行）
```bash
conda activate education
source ../education_config.sh           # ../ 相对于项目根目录 education/
cd ai-learning-island/backend && python3 main.py
# 服务运行在 http://localhost:8000
```

## 数据库
- MySQL 数据库: `education`，用户: `education_admin`
- 配置通过 `education_config.sh` 环境变量注入（不写入代码）
- 启动时自动建表（6 张表：child_profile, dudu_state, memory_events, session_records, math_levels, wrong_answers）

## 敏感信息
- API Key 和数据库密码存储在项目根目录同级的 `education_config.sh`
- 不要将任何密钥提交到 Git 仓库

## 架构概览（v2.0 松耦合）

### 目录结构
```
ai-learning-island/
├── backend/
│   ├── main.py            # FastAPI 应用 + API 路由
│   ├── database.py        # MySQL 连接池 + 初始化建表
│   ├── dialogue_engine.py # 嘟嘟对话逻辑
│   ├── tts_service.py     # MiniMax TTS 语音
│   └── models.py          # Pydantic 数据模型
├── frontend/
│   ├── index.html         # 入口 + 所有面板（学科选择/路线图/答题/蘑菇屋/商店/报告）
│   ├── css/main.css       # 全局样式（v2.0 学科页 + 路线图样式）
│   └── js/
│       ├── app.js         # 主逻辑：初始化、游戏循环、Canvas渲染、答题流程
│       ├── dialogue-ui.js # 嘟嘟对话UI + TTS音频队列
│       └── gamepad.js     # 手柄管理器
└── modules/               # v2.0 模块系统
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
  "route": "sprout",     // 所属路线
  "order": 4,            // 排序
  "entry": "/api/challenge/ten_complement"  // 对应的答题API
}
```

**status 含义**: ready=已实现可使用 | developing=开发中 | planned=灰色规划中 | draft=禁用

### 数据流
```
用户 → 学科选择页 → 选择数学大陆
    ↓
/api/modules  →  渲染路线图（按 route 分组，按 order 排序）
    ↓
用户点击模块卡片 → enterModule() → 进入探索模式（旧版答题系统）
    ↓
答题完成 → 更新数学等级/水晶/错题本 → 结算 → 返回路线图
```

### 前端页面流程
1. **学科选择页** (#subject-select): v2.0 入口，展示数学/语文/英语三个学科卡片
2. **路线图** (#map-view): 从 `/api/modules` 获取模块列表，显示模块卡片（彩色/灰色/锁定）
3. **探索模式** (Canvas): 角色移动 + 谜题发现，旧版游戏循环
4. **答题模式**: 选择题 + 凑十法/破十法步骤教学动画
5. **结算/报告**: 学习报告、蘑菇屋装饰商店

### API 路由
| 端点 | 说明 |
|------|------|
| `GET /api/modules` | 获取所有模块（路线图数据源） |
| `GET /api/modules/{id}` | 获取单个模块详情 |
| `GET /api/challenge/{module_id}` | 获取模块题目（答案经验证） |
| `GET /api/profile` | 孩子档案 |
| `POST /api/dialogue` | 嘟嘟对话生成 |
| `GET /api/tts?text=` | 文本转语音 |
| `GET /api/math-levels` | 数学等级数据 |
| `GET/POST /api/memories` | 记忆系统 |
| `GET /api/sessions` | 学习记录 |
| `GET /api/report` | 家长报告 |
| `GET /api/wrong-answers` | 错题本 |
| `GET /api/memories/learning-insights` | L2学习洞察 |
| `GET /api/shop/items` | 装饰商店 |
| `POST /api/dudu/mood` | 嘟嘟心情 |

### 当前重构状态（v2.0）
- ✅ 模块目录 + config.json（6个模块）
- ✅ `/api/modules` 后端端点
- ✅ 学科选择页 UI
- ✅ 路线图渲染
- ✅ 模块→答题直接跳转（`/api/challenge/{id}`）
- ✅ 题目验证系统（每道题的答案必须在选项中）

## 题目生成与验证系统
- **静态模板**: 数感/图形/钟表/凑十法/破十法（答案固定，写在模板中）
- **动态生成器**: 加法/减法/代数思维（随机出题 + 同步计算答案）
- **选项生成** (`_gen_options`): 以正确答案为中心生成干扰项，确保正确答案始终在选项中
- **双重验证**: 生成后校验 `answer in options`，不通过则重新生成
