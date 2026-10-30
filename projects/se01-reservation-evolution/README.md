# SE01：预约库的规格、替换与演化

本图谱原创 Java 教学项目。先写预测，再阅读参考实现：A 已有 [10,20)，[20,30)、[19,21)、[5,5) 各会怎样？清空查询返回列表会不会取消预约？

## 任务与命令

实现一个单进程本地 CLI；资源名采用 ASCII 字母、数字、下划线、横线，整数时隙非负，采用半开区间。无账号、支付、云、持久化或多用户并发。进程退出即丢失记录。

在仓库根目录使用 Python 3.11+ 与 JDK 17 标准库：

```powershell
python -B -X utf8 projects/se01-reservation-evolution/run.py --out results/se01
```

入口在新的系统临时目录执行 `javac -encoding UTF-8 -d <temp> ...`，再运行 `java -ea -cp <temp> ContractTests` 与两个 CLI fixture。每个子进程 30 秒超时，编译产物自动回收，独立结果目录保留 results.json 和 run.log。实际 javac/java 命令、版本、源码及输入 SHA-256 均写入结果。已实测 Microsoft OpenJDK/javac 17.0.19，Windows x86_64；其他平台未验证。

手动体验（PowerShell，从仓库根目录）：

```powershell
New-Item -ItemType Directory -Force results/se01-classes | Out-Null
javac -encoding UTF-8 -d results/se01-classes projects/se01-reservation-evolution/src/*.java
java -ea -cp results/se01-classes ReservationCli list
```

输入 `reserve A 10 20`、`list`、`cancel 1`、`cancel-if-present 1`、`quit`。参数 `tree` 可选择替代存储。非法命令、数字和业务失败给出 ERROR 后继续；拒绝不写入、不消耗 ID。Java int 最大端点也有边界用例；ID 耗尽时明确拒绝，未对数十亿次运行作实测。

## 交付物与先做任务

1. 根据 [requirements.md](requirements.md) 独立填写追踪表与验收，别先抄实现。
2. 根据 [specification.md](specification.md) 写 reserve/list/cancel 的调用前后关系，并解释异常优先级。
3. 根据 [representation.md](representation.md) 写列表和树的 AF/RI，画返回集合的别名关系。
4. 阅读 [adr-001.md](adr-001.md)，只替换装配存储后跑同一契约，说明真实成本。
5. 根据 [refactor-001.md](refactor-001.md) 比较 InlineBook 与提取后的 OverlapRule。原版和新版均实际跑测试。
6. 根据 [change-002.md](change-002.md) 验证新增取消入口与旧异常契约分别成立。

参考实现中 Slot 不可变，返回可修改的独立列表副本。端口与适配器都由 Book 私有持有；示例不是并发安全库。写入时内存耗尽、JVM 崩溃与未来外部存储的故障原子性不在保证范围内。

## 预期与实际分别记录

预期：四套 before/after × list/tree 契约、225 对小区间的独立整数集合 oracle、闭区间与泄漏错误见证及两个真实 CLI fixture 均通过。错误见证是有意构造的旧式错误片段，测试明确检查它们违反哪条契约；整体测试成功不表示错误实现正确。项目不是全输入形式化证明。

开发者最小实跑结果登记在 `_build/verify/se-alg-arch/eng-project/results.json`，实际输出见同目录 run.log。用户完成应另写：预测、修改差异、实际命令、结果、失败原因和一个迁移输入；开发者通过不自动代表用户掌握。建议迁移：已有 [4,8)，测试 [1,4)；再增加第三资源并解释为什么不冲突。

## 来源

- MIT 6.102 Spring 2025，Testing：https://web.mit.edu/6.102/www/sp25/classes/02-testing/
- MIT 6.102 Spring 2025，Specifications：https://web.mit.edu/6.102/www/sp25/classes/04-specifications/
- MIT 6.102 Spring 2025，AF/RI：https://web.mit.edu/6.102/www/sp25/classes/07-abstraction-functions-rep-invariants/

课程讲义用于概念依据，本项目、输入、Java 代码与测试为本站原创，不是官方课程实验。
