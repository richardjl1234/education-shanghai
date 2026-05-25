# 数学魔法岛 v2.0 架构文档

> 版本：v2.0  
> 日期：2026-05-25  
> 状态：重构中

## 一、核心理念

**像文件系统一样挂载模块** —— 每个知识点是一个独立的"模块"，通过配置文件声明式挂载，路线图自动渲染。

```
📂 modules/
├── # 每个模块一个目录
├── number_sense/        # 数感启蒙
│   ├── config.json      # 模块配置（名称、状态、依赖）
│   └── module.py       # 模块逻辑（可选）
├── ten_complement/     # 凑十法
│   └── config.json
├── borrowing_sub/     # 破十法
│   └── config.json
└── clock_time/        # 认识钟表
    └── config.json
```

## 二、松耦合设计

### 2.1 模块接口契约

```json
// config.json - 每个模块的声明
{
  "id": "ten_complement",
  "name": "凑十法",
  "icon": "🔟",
  "status": "ready",        // ready=已实现 | developing=开发中 | planned=规划中
  "grade": 1,               // 适用年级
  "depends": ["addition"],  // 依赖的其他模块
  "route": "sprout",        // 所属路线：sprout/valley/star/castle/dragon
  "entry": "/api/challenge/ten_complement"
}
```

### 2.2 路线图自动发现

```python
# 路径图引擎：扫描 modules/ 目录，自动构建路线图
def scan_modules():
    modules = []
    for dir in Path("modules").iterdir():
        if dir.is_dir() and (dir / "config.json").exists():
            modules.append(load_config(dir / "config.json"))
    return sorted(modules, key=lambda m: (m.route, m.grade, m.id))
```

### 2.3 挂载/卸载

| 操作 | 命令 | 效果 |
|------|------|------|
| 挂载新模块 | 复制模块目录到 modules/ | 路线图自动出现 |
| 卸载模块 | 删除或重命名目录 | 路线图自动消失 |
| 禁用模块 | config.json 中 status=draft | 显示为灰色 |
| 启用模块 | config.json 中 status=ready | 显示为彩色 |

## 三、五大领地路线

```
┌─────────────────────────────────────────────────────────────┐
│                      数学魔法岛 🗺️                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🌱 萌芽森林 (Sprout Forest)                                │
│  ├── 数感启蒙 (1-20)                                        │
│  ├── 5以内加减                                              │
│  ├── 10以内加减                                             │
│  ├── 20以内不进位                                           │
│  ├── 凑十法 ➡️                                             │
│  ├── 破十法 ➡️                                             │
│  ├── 认识图形                                               │
│  ├── 认识钟表                                               │
│  └── 代数启蒙 □+5=9                                        │
│                                                             │
│  🧭 智慧山谷 (Wisdom Valley)                               │
│  ├── 100以内加减                                           │
│  ├─�� 表内乘除                                               │
│  ├── 厘米和米                                               │
│  ├── 角的认识                                               │
│  └── 观察物体                                               │
│                                                             │
│  🔮 星辰原野 (Star Field)                                  │
│  ├── 万以内加减                                             │
│  ├── 多位数乘一位                                           │
│  ├── 分数初步                                               │
│  ├── 面积计算                                               │
│  └── 代数入门 a+3=9                                         │
│                                                             │
│  🏰 几何城堡 (Geometry Castle)                            │
│  ├── 垂直与平行                                            │
│  ├── 三角形                                                 │
│  ├── 大数认识                                               │
│  └── 简易方程                                               │
│                                                             │
│  🐉 挑战龙穴 (Dragon Lair)                                 │
│  ├── 浅奥入门                                               │
│  ├── 数论                                                   │
│  ├── 几何切割                                               │
│  └── 逻辑推理                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 四、模块状态定义

| status | 显示 | 说明 |
|--------|------|------|
| `ready` | 🟢 彩色 | 已实现，可使用 |
| `developing` | 🟡 橙色 | 开发中，可测试 |
| `planned` | ⚪ 灰色 | 规划中，待开发 |
| `draft` | ⬜ 灰 | 禁用，不显示 |

## 五、MVP 阶段

### 5.1 目标
验证松耦合架构 + 路线图导航

### 5.2 实现内容
- 入口页（数学大陆按钮）
- 简单路线图（萌芽森林模块列表）
- 已有答题系统无缝接入

### 5.3 文件结构
```
ai-learning-island/
├── modules/
│   ├── number_sense/      # 数感启蒙
│   │   └── config.json
│   ├── addition/         # 加法
│   │   └── config.json
│   ├── subtraction/     # 减法
│   │   └── config.json
│   ├── ten_complement/  # 凑十法
│   │   └── config.json
│   ├── borrowing_sub/   # 破十法
│   │   └── config.json
│   └── clock_time/      # 认识钟表
│       └── config.json
├── router/
│   ├── map_renderer.py  # 路线图渲染
│   └── module_loader.py # 模块加载器
└── ...
```

## 六、数据流

```
用户点击 → 入口页
    ↓
选择"数学大陆"
    ↓
router.scan_modules() → 加载所有 config.json
    ↓
渲染路线图（按 route 分组，按 grade 排序）
    ↓
用户点击模块（如"凑十法"）
    ↓
跳转至 module.entry（调用已有 API）
    ↓
答题完成 → 更新进度 → 返回路线图
```

## 七、后续扩展

### 添加新学科
```
新增目录：subjects/chinese/
├── map_config.json     # 学科配置
└── modules/
    ├── pinyin/         # 汉语拼音
    ├── characters/     # 生字
    └── reading/       # 阅读理解
```

### 模块间依赖
```json
// config.json
{
  "depends": ["addition"],
  "unlock_condition": "complete:addition"
}
```

---

_核心原则：配置即代码，目录即模块_