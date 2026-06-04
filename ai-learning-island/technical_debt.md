# Technical Debt — AI 学习岛

记录项目里**已知但暂时不修**的技术债,以及未来修复的思路。

---

## TD-001: math_levels 启动时 Duplicate entry 警告

**现状**:
服务启动时 `backend/main.py:41` 的 `INSERT IGNORE INTO math_levels (topic, level) VALUES (...)` 会在 aiomysql 上触发 8 条 `Warning: Duplicate entry 'X' for key 'math_levels.topic'`。

**影响**:
- 启动日志有 8 行噪音(纯视觉)
- 不影响功能和数据正确性
- 启动完成后日志干净,运行期无 warning
- 性能影响 < 50ms

**根因**:
- `math_levels.topic` 列上有 `UNIQUE` 索引
- `INSERT IGNORE` 在 MySQL 端正确静默,但 aiomysql 的 cursor 实现仍把 Note 级 warning 转发到 Python logging
- 同样的问题也出现在 `CREATE TABLE IF NOT EXISTS`(7 个表都有"Table already exists"warning)

**尝试过的方案**(均未完全生效):
1. `SET SESSION sql_notes = 0` 在 cursor 上下文里 — 只对当前连接生效,后续连接不继承
2. `aiomysql.create_pool(init_command="SET SESSION sql_notes = 0")` — 旧版 aiomysql 似乎不应用 init_command
3. 改用 SELECT-then-INSERT — 能解决但代码冗余,本质是规避而非修复

**未来真正修复的方向**:
1. **换驱动**: 用 `pymysql`(同步)或 `asyncmy`(纯 asyncio)替代 aiomysql,这些驱动对 Note 级 warning 处理更干净
2. **包成 context manager**: 在 `INSERT IGNORE` / `CREATE TABLE IF NOT EXISTS` 外层包 `with warnings.catch_warnings(): warnings.simplefilter("ignore")`,吞掉 Python 层面的 aiomysql warning
3. **移除 UNIQUE 索引**: 把 `math_levels.topic` 的 UNIQUE 约束去掉,改在应用层保证唯一(不推荐,丢失数据库保护)

**修复优先级**: 低(纯噪音,无功能影响)

---

## TD-002: 7 张表 CREATE TABLE IF NOT EXISTS 警告

同 TD-001,见上方"根因"和"未来修复方向"。
