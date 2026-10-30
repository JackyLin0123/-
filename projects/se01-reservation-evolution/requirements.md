# 需求与追踪表

角色：离线预约管理员。目标：一个资源的占用时段不能重复，能列出并取消。假设：整数时隙代替日期；无需时区、登录、并发与重启恢复。

| 需求 | 规格 | 验收测试 | 源位置 | 变更记录 |
|---|---|---|---|---|
| R1 合法预约及冲突拒绝 | C1 reserve | touch/overlap/invalid/no mutation | BaseBook.reserve、OverlapRule | refactor-001 |
| R2 可安全查询 | C2 list | alias attack/old snapshot/sort | BaseBook.list、Slot | refactor-001 |
| R3 取消指定预约 | C3 cancel | remove/missing exception/reuse | BaseBook.cancel | 保持旧契约 |
| R3b 重复取消安全 | C4 cancelIfPresent | true then false/old entry retained | BaseBook.cancelIfPresent、CLI | change-002 |

每条修改绑定源码摘要与 run.py 结果；此表中的记录名是本项目教学变更身份，不冒充仓库真实 Git 提交。产品验收由用户自评另行记录。
