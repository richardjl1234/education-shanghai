# 数学魔法岛 - 项目配置

## 技术栈
- **后端**: Python 3.11 (conda env: `education`)
- **前端**: HTML5 Canvas + 原生 JS
- **数据库**: MySQL (aiomysql)
- **TTS**: MiniMax Token Plan API

## 环境激活
```bash
conda activate education
source /home/richard/shared/jianglei/claude/education_config.sh
```

## 启动后端
```bash
cd /home/richard/shared/jianglei/claude/education/math-magic-island/backend
python3 main.py
```

## 数据库
- MySQL 数据库: `education`
- 用户: `education_admin`
- 配置通过 `education_config.sh` 环境变量注入（不写入代码）

## 敏感信息
- API Key 和数据库密码存储在 `/home/richard/shared/jianglei/claude/education_config.sh`
- 不要将任何密钥提交到 Git 仓库