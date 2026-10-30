# REFACTOR-001：提取冲突规则，保持行为

前版：InlineBook.overlaps 直接计算 `same resource && a.start<b.end && b.start<a.end`。后版：ReservationBook 委托 OverlapRule，表达式完全相同。两版都继承 BaseBook；输入校验、ID 分配、返回排序、异常与副作用顺序不变。没有改成闭区间。

证据：ContractTests 对 before/after × list/tree 四种实例实际执行相同契约；225 对 [0,5] 小区间用整数 membership oracle，再比较每步快照和下一成功 ID。固定 SE-T1/SE-T2 对输入与返回集合攻击分别验证。

失败后修复见证：闭区间片段用 <= 错拒 [20,30)，同输入在严格 < 版本接受；泄漏列表片段被 clear 后丢失预约，复制+不可变 Slot 版本保留内部。错误片段已作为有意违反契约的见证在测试中执行，修复不是声称旧错误行为保持。

这是可复查的本地源码快照对照，并非已创建真实重构 Git 提交。形式化推导在表达式等价及更新顺序审查；有限枚举不能证明所有未来实现。需求变化另见 CHANGE-002。
