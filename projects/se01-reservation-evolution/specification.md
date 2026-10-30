# 行为规格

所有 API 在单线程、正常 JVM 运行、内存充足下使用；Store 对调用者不可访问。资源为匹配 `[A-Za-z0-9_-]+` 的字符串。时隙为 Java int 且 0<=start<end，半开区间。

抽象状态为 `(B,k)`，B 是当前有效预约集合，k 是下一次成功分配的ID；初始 `(∅,1)`。正常可分配范围为 1..Integer.MAX_VALUE，k=Integer.MAX_VALUE+1 表示耗尽。k 虽非直接查询字段，仍影响后续 reserve 的可观察返回值。

- C1 reserve：按参数校验→ID耗尽→同资源冲突的顺序拒绝，分别抛 IllegalArgumentException、IllegalStateException、ConflictException，均保持整个 `(B,k)`。若通过，返回 k，添加恰一条 `(k,resource,start,end)`，状态变为 `(B∪{该条},k+1)`。不同资源可同时段。
- C2 list：不改库；返回独立可修改列表，元素 Slot 不可变；按 resource,start,end,id 递增排序。修改列表及保留旧快照不影响库；新预约不改变旧快照。
- C3 cancel：存在 ID 时删除恰该条，k不变；未知 ID 抛 NoSuchElementException 且保持 `(B,k)`。活动预约全部取消后，下一次成功仍不得复用历史已分配ID。
- C4 cancelIfPresent：新增入口；存在时删除并 true，未知时 false，二者都保持k。原 C3 不变。

由初始 k=1、成功仅递增1、其他操作不改k归纳，历史已分配ID集合是 `{1,...,k-1}`；B中ID只是仍有效的子集。例如 `(∅,1)` 与 `(∅,2)` 查询结果相同，但下一次成功分别返回1和2，不能据空查询判定为同一个抽象状态。失败不消耗ID意味着失败后k不变，不能只比较B。

可替换性：TreeStore 不得增加必须先排序、不得从 0 开始等限制，也不得改异常和返回对象所有权。本模型 Store.snapshot 返回独立副本，insert/remove 原子完成；本地内存适配器不提供崩溃持久性。
