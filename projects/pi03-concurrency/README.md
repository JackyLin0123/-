# 看见丢失更新，再正确同步

这是本图谱原创教学组合，不是产品真实案例或论文复现。任务先于参考实现；先完成预测，再检查源码。Pi 必需分支当前待实机验证。

## 先预测

预测：两个线程先 atomic_load(0)，再 atomic_store(old+1)，最终值多少？各次原子为何仍不够？

## 运行与产物

Pi/Linux Bash：
```bash
python3 projects/pi03-concurrency/run.py --rounds 3 --out results/pi03
```
Windows PowerShell（需要提供 pthread 和 C11 atomics 的 GCC）：
```powershell
python -X utf8 projects/pi03-concurrency/run.py --rounds 3 --out results/pi03
```
顺序一致原子 load/store，两个阶段屏障；条件变量屏障支持伪唤醒循环。日志锁覆盖单个原子操作及记录，屏障不放在持锁区。RMW 和 mutex 完成相同总更新次数；--rounds 范围 1..1000，排除计数溢出，最多 4000 事件。

## 核验与解释

一轮分离 load/store=1，RMW=2，mutex=2；三轮分别 3、6、6。逐步读实际序号日志：每轮两次 load 值相同，再两次 store 值相同。日志顺序不是精确时钟，不声称代表无干预的 Linux 调度。普通/volatile 共享 counter++ 的数据竞争是 C 未定义行为，不是主实验；volatile 不是修复。

## 渐进提示

1. 先手算一轮四个共享访问
2. 把“访问原子”与“整个更新原子”分开
3. 屏障等待时不持有日志/计数互斥锁

## 扩展与失败检查

- 改变 rounds 验证三种不变量
- 移除阶段屏障作为有定义的原子分离更新扩展，保存实际结果，不承诺固定丢失次数

## 共用边界与恢复

先完成 [PI00 准备](../pi00-setup/README.md)。在仓库根目录执行命令；--out 是本实验独立输出目录。默认预算 60 秒，上限 300 秒；超时/取消会回收子进程并在 results.json 保留原因，不提高热保护阈值、不强制 root。清理时只删除自己指定的 results/piXX 目录；不要删除源文件或别的结果。

结果含环境、实际 targetId、源码与输入摘要、配置、原始数据、断言和缺失原因。将结果导入图谱 [实验结果查看器](../../index.html#/lab/eng-measurement-workbench)。导入不会升级开发者验证状态，也不自动标记节点掌握。实际 Pi 5/Linux/AArch64、Windows、其他 Linux 的记录分开；开发机/模拟器不能代替板上证据。

每次记录：预测及理由；唯一改变量；环境/种子/运行命令；原始结果文件；支持哪个解释；两个仍未排除的因素；下一次实验。至少完成一次改变量后的迁移并解释结果，再自评完成。

## 来源与适用范围

- https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf

来源用于对应接口/数值方法的边界；不表示整个项目照搬官方实验。
