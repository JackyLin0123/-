# 缓存、工作集和测量边界

这是本图谱原创教学组合，不是产品真实案例或论文复现。任务先于参考实现；先完成预测，再检查源码。Pi 必需分支当前待实机验证。

## 先预测

预测：相同访问次数，顺序扫描和依赖随机指针追逐谁更慢？若没有清晰拐点，是否说明实验失败？

## 运行与产物

先执行小规模正确性 smoke：
```bash
python3 projects/pi05-memory-measurement/run.py --max-mib 1 --accesses 4096 --out results/pi05-smoke
```
再做默认测量，Pi/Linux Bash：
```bash
python3 projects/pi05-memory-measurement/run.py --out results/pi05 --budget 300
```
Windows PowerShell 使用 python -X utf8 代替 python3，属于独立 Windows 开发环境。默认工作集 4 KiB 到 8 MiB；最大可选 128 MiB，分配上限还取 25% MemAvailable，未知则保守 4 MiB。不增加 swap。顺序模式读连续索引，随机模式使用固定种子生成的单一 Sattolo 循环，下一地址依赖上次加载。每配置固定访问次数、先预热、随机化配置顺序、至少 5 次重复。计时不含分配/初始化/I/O，校验和可见，使用单调时钟。

## 核验与解释

检查每次 checksum、访问次数、原始 ns/access；与 median/q25/q75/IQR 表逐项核对。查看 -O2 产物确认扫描未消除（保存了可见 checksum），不得按预设拐点筛选结果。若温度/频率不可读，正确性仍可测试，性能结论标信息不足；本轮当前节流/欠压或达到 80°C 时停止后续采样，保留已采数据和原因。历史节流位与当前位分开。

## 渐进提示

1. 先控制访问次数，不能一边增大工作集一边增加总访问量
2. 区分 CPU 缓存、TLB、预取、频率和调度等混杂因素
3. 没有跳变是合法结果；官方规格参考线不是测量拟合结论

## 扩展与失败检查

- 只改变访问次数或工作集上限，记录新配置
- 检查 perf 权限后自行加计数器，对比 TLB/预取假设；不可用必须 skipped+reason，不填 0

## 共用边界与恢复

先完成 [PI00 准备](../pi00-setup/README.md)。在仓库根目录执行命令；--out 是本实验独立输出目录。默认预算 60 秒，上限 300 秒；超时/取消会回收子进程并在 results.json 保留原因，不提高热保护阈值、不强制 root。清理时只删除自己指定的 results/piXX 目录；不要删除源文件或别的结果。

结果含环境、实际 targetId、源码与输入摘要、配置、原始数据、断言和缺失原因。将结果导入图谱 [实验结果查看器](../../index.html#/lab/eng-measurement-workbench)。导入不会升级开发者验证状态，也不自动标记节点掌握。实际 Pi 5/Linux/AArch64、Windows、其他 Linux 的记录分开；开发机/模拟器不能代替板上证据。

每次记录：预测及理由；唯一改变量；环境/种子/运行命令；原始结果文件；支持哪个解释；两个仍未排除的因素；下一次实验。至少完成一次改变量后的迁移并解释结果，再自评完成。

## 来源与适用范围

- https://www.raspberrypi.com/products/raspberry-pi-5/

来源用于对应接口/数值方法的边界；不表示整个项目照搬官方实验。
