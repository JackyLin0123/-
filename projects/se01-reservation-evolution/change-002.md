# CHANGE-002：新增安全重复取消入口

旧需求 R3/C3：未知 ID 取消抛 NoSuchElementException。新需求 R3b/C4：脚本可以重复请求取消，第一次 true，之后 false。选择新增 cancelIfPresent，保留旧 cancel 的行为，避免旧异常分支静默失效。

影响：BaseBook 新方法；CLI 新命令及启动帮助；规格 C4；契约测试与 CLI fixture；需求追踪表。没有持久化格式与网络协议。新增能力与纯提取规则重构分别审查。

验收：成功预约→cancelIfPresent true→再次 false；list 空；原 cancel 同 ID 仍抛异常；重新预约合法且分配新 ID。两种 Store 均运行，同步比较四种原版/重构组合。下一扩展若引入账户所有权，须重写授权规格和验收，当前模型不涵盖。
