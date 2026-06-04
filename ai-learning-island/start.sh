#!/usr/bin/env bash
# start.sh — 启动 AI 学习岛后端服务并打印使用说明
#
# 用法:
#   ./start.sh           # 前台启动（推荐用于开发调试）
#   ./start.sh --bg      # 后台启动，日志写入 backend.log
#   ./start.sh --stop    # 停止后台进程
#   ./start.sh --status  # 查看运行状态

set -e

# 路径解析（脚本位置为锚点）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
CONFIG_FILE="$SCRIPT_DIR/../education_config.sh"
BACKEND_DIR="$PROJECT_ROOT/backend"
PID_FILE="$PROJECT_ROOT/.backend.pid"
LOG_FILE="$PROJECT_ROOT/backend.log"
PORT=8000

# ─── 颜色 ─────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── 辅助函数 ─────────────────────────────────────────────────────
print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "  🌟 ═══════════════════════════════════════════════ 🌟"
    echo "       AI 学习岛 (ai-learning-island)  启动脚本"
    echo "  🌟 ═══════════════════════════════════════════════ 🌟"
    echo -e "${RESET}"
}

print_usage() {
    cat <<EOF

${BOLD}📖 使用说明${RESET}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${BOLD}1. 访问应用${RESET}
   浏览器打开:  ${GREEN}http://localhost:${PORT}${RESET}
   TV 大屏模式:  浏览器设置 → 请求桌面版站点
                 或按 F11 进入全屏

${BOLD}2. 首次使用 — 注册账号${RESET}
   - 在登录页点击「注册」标签
   - 填写: 孩子名字 / 用户名 / 密码 / 年龄
   - 注册成功 → 自动登录

${BOLD}3. 已有账号 — 登录${RESET}
   - 默认登录页: 输入用户名 + 密码
   - Token 保存在浏览器 localStorage,7 天有效

${BOLD}4. 应用主流程${RESET}
   登录页 → 学习大陆（选学科）
     └─ 数学大陆（已开放）
          └─ 学习路线图 → 选择知识点
               ├─ 萌芽森林: 数感 / 5以内加减法
               ├─ 智慧山谷: 凑十法 / 破十法
               └─ 星空城堡: 钟表(规划中)
   答完一轮题 → 结算（水晶 💎 / 嘟嘟心情）→ 返回路线图

${BOLD}5. 关键操作${RESET}
   - 答题:   鼠标点击选项 / 手柄 A 键
   - 凑十法: 答对后可点「查看动画演示」看分步骤拆解
             点「下一题」跳过动画直接下一题
   - HUD 菜单 (右上 ☰):
       • 👤 个人资料 — 改名字/年龄/密码
       • ⚙️ 设置 — 调整每轮题目数 (2-10)
   - 嘟嘟对话: 按 A 键继续

${BOLD}6. 家长功能${RESET}
   - HUD → 个人资料
   - 路线图右下「📊 学习报告」:
       • 知识点能力分布 / 薄弱环节
       • 最近 7 天正确题数
   - 蘑菇屋 🏠: 用水晶购买装饰装扮嘟嘟

${BOLD}7. 常用 API 端点${RESET}
   - POST /api/auth/login        登录
   - POST /api/auth/register     注册
   - GET  /api/modules           模块列表
   - GET  /api/challenge/{id}?count=N  题目
   - GET  /api/report            学习报告
   - GET  /api/dudu              嘟嘟状态
   完整路由见 backend/main.py

${BOLD}8. 故障排查${RESET}
   - 端口 ${PORT} 被占:  lsof -i:${PORT}  → kill <PID>
   - MySQL 报错:  检查 education_config.sh 中的 DB 配置
   - 重置:  删除数据库 education（会自动重建）
   - 日志:  ${LOG_FILE}

${BOLD}9. 停止服务${RESET}
   ./start.sh --stop

${BOLD}10. 配置文件${RESET}
   ${CONFIG_FILE}
   包含: MySQL 密码 / MiniMax API Key 等敏感信息
   ⚠️  已在 .gitignore 中,不要提交到 Git

EOF
}

# ─── 检查依赖 ─────────────────────────────────────────────────────
check_deps() {
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}✗ 配置文件不存在: ${CONFIG_FILE}${RESET}"
        exit 1
    fi

    if ! command -v conda &> /dev/null; then
        echo -e "${RED}✗ conda 未安装或未在 PATH 中${RESET}"
        exit 1
    fi

    # 检查 conda 环境是否存在
    if ! conda env list 2>/dev/null | grep -qE "^\s*education\s"; then
        echo -e "${RED}✗ conda 环境 'education' 不存在${RESET}"
        echo "  创建: conda create -n education python=3.11"
        exit 1
    fi
}

# ─── 启动 / 停止 / 状态 ──────────────────────────────────────────
is_running() {
    [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start_foreground() {
    check_deps
    print_banner
    echo -e "${YELLOW}⏳ 启动中... (按 Ctrl+C 停止)${RESET}\n"

    set -a
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
    set +a

    cd "$BACKEND_DIR"
    exec python3 main.py
}

start_background() {
    check_deps
    if is_running; then
        echo -e "${YELLOW}⚠ 服务已在运行 (PID: $(cat "$PID_FILE"))${RESET}"
        echo "  停止: ./start.sh --stop"
        return
    fi

    print_banner
    echo -e "${YELLOW}⏳ 后台启动中...${RESET}"

    set -a
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
    set +a

    cd "$BACKEND_DIR"
    nohup python3 main.py > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    # 等待服务就绪
    for i in {1..15}; do
        if curl -sf "http://localhost:${PORT}/api/modules" > /dev/null 2>&1 \
           || curl -s "http://localhost:${PORT}/" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ 服务已启动 (PID: $(cat "$PID_FILE"))${RESET}"
            echo -e "  日志:  ${LOG_FILE}"
            echo -e "  访问:  ${GREEN}http://localhost:${PORT}${RESET}"
            print_usage
            return
        fi
        sleep 1
    done
    echo -e "${YELLOW}⚠ 启动超时,请检查日志: ${LOG_FILE}${RESET}"
}

stop_service() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        kill "$PID"
        rm -f "$PID_FILE"
        echo -e "${GREEN}✓ 已停止服务 (PID: ${PID})${RESET}"
    else
        echo -e "${YELLOW}⚠ 服务未运行${RESET}"
        rm -f "$PID_FILE"
    fi
}

show_status() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        echo -e "${GREEN}● 运行中${RESET} — PID: ${PID} | 端口: ${PORT}"
        echo "  日志: ${LOG_FILE}"
        if [ -f "$LOG_FILE" ]; then
            echo "  --- 最近 5 行 ---"
            tail -n 5 "$LOG_FILE" | sed 's/^/    /'
        fi
    else
        echo -e "${RED}● 未运行${RESET}"
    fi
}

# ─── 入口 ────────────────────────────────────────────────────────
case "${1:-}" in
    --bg)
        start_background
        ;;
    --stop)
        stop_service
        ;;
    --status)
        show_status
        ;;
    --help|-h)
        print_banner
        echo "用法: $0 [选项]"
        echo "  (无参数)   前台启动"
        echo "  --bg       后台启动"
        echo "  --stop     停止服务"
        echo "  --status   查看状态"
        echo "  --help     帮助"
        ;;
    "")
        start_foreground
        ;;
    *)
        echo -e "${RED}未知选项: $1${RESET}"
        echo "运行 '$0 --help' 查看帮助"
        exit 1
        ;;
esac
