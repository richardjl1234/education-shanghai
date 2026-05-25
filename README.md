# AI 学习伙伴

一个陪伴孩子从幼小衔接到小学毕业的 AI 学习伙伴，通过游戏化方式闯关学习各学科。

## 项目结构

```
education/
├── ai-learning-island/          # 应用项目（可运行的游戏应用）
│   ├── backend/                 # FastAPI 后端
│   ├── frontend/                # HTML5 Canvas 前端
│   └── modules/                 # 知识点模块（声明式挂载）
│
├── ai-learning-partner-v2-arch.md   # 整体架构设计文档
├── ai-learning-island-v2-arch.md    # 应用项目架构文档
│
└── old_documents/               # 历史规划文档
```

**关系说明**：`ai-learning-partner-v2-arch.md` 定义整个 AI 学习伙伴的理念和宏观设计（多学科、学习路线等），`ai-learning-island/` 是其具体实现，`ai-learning-island-v2-arch.md` 记录该应用的详细架构。
