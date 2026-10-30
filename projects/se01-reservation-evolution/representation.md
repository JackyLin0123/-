# 抽象函数、表示不变量和封装

抽象状态是 `(B,k)`：B 是当前有效的 `(ID,resource,start,end)` 无序集合，k 是下一次成功新增将返回的 ID。k 虽没有 getter，仍能通过将来的 reserve 返回值观察，必须纳入抽象状态。

AF(ListStore.slots,nextId)=(列表元素所表示的B,nextId)；AF(TreeStore.slots,nextId)=(映射values所表示的B,nextId)。内部顺序不属于抽象值，外部 list 统一排序。新建空库状态为 `(∅,1)`；先成功分配1再取消的库为 `(∅,2)`。活动集合相同，下一次成功返回值不同，二者不应被AF合成同一状态。

RI：字段/元素非 null，名称符合契约，0<=start<end，活动 ID 唯一、为正且小于 nextId；同资源两段不相交；`1<=nextId<=Integer.MAX_VALUE+1L`。树另保持 key=slot.id。注意“小于nextId”仅限制当前有效ID，不能单凭这一静态条件证明历史ID不重用。

历史论证依赖初始状态和转移：空构造 k=1；每次成功 reserve 返回 k 并转成 `(B∪{(k,r)},k+1)`；失败、查询以及取消均保持 k，取消只缩小 B。因此归纳可得历史已分配ID恰为 `{1,...,k-1}`，其中取消过的ID仍属历史集合，活动ID只是它的子集。实现不另存历史集合，因为递增标记编码了这段连续分配历史。把 k 重置为 `max(activeID)+1` 会丢失取消历史，违反转移规则；即使新状态仍满足活动ID的下界条件，也不能证明行为兼容。

Java 用 long 保存 nextId，以表示最后分配 `Integer.MAX_VALUE` 后的耗尽标记 `Integer.MAX_VALUE+1L`；成功分配时才转为 int。reserve 顺序为参数校验→耗尽检查→冲突检查→写入→递增；各类拒绝均保持 `(B,k)`。checkRep 检查当前表示和计数范围，成对区间检查为 O(n²)；历史不重用仍需上述转移归纳，不能只靠 checkRep 绿灯。当前模型无反射修改、并发或进程崩溃保证。

Slot 的 int 和 String 字段 final，不含可变嵌套对象；snapshot 返回外层新 ArrayList，因此浅复制在此足够。若改为 Date 等可变字段，需重新审查和复制。`Collections.unmodifiableList(internal)` 是不可修改视图，仍可能随内部变化，不等于旧快照。测试显式清空返回列表，再查询内部，还会在保留旧结果后新增以验证快照不是活视图。
