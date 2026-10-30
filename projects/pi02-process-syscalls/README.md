# 进程的地址、状态与系统调用

这是本图谱原创教学组合，不是产品真实案例或论文复现。任务先于参考实现；先完成预测，再检查源码。Pi 必需分支当前待实机验证。

## 先预测

预测：fork 后父子对应变量的地址相同，子进程写入 99 后，父值是否也会变 99？

## 运行与产物

Pi/Linux Bash（安装 gcc/strace 是一次性联网准备）：
```bash
python3 projects/pi02-process-syscalls/run.py --out results/pi02
```
Windows PowerShell 可执行下行，结果会明确 skipped；它不会将 Windows 伪装成 fork 实验：
```powershell
python -X utf8 projects/pi02-process-syscalls/run.py --out results/pi02-windows
```
有 WSL 时，在实际 WSL Linux 内用上面的 Bash 命令；本次开发环境 WSL 启动受限，未验证。process.c 检查 pipe/fork/waitpid 返回值、完整管道传输、fflush、文件描述符回收；io.c 使用临时目录、O_EXCL、完整读写和 fsync。strace 缺失不会填 0，也不能完成调用观察验收。

## 核验与解释

父子 PID 不同，继承的对应虚拟地址相同；父 7→7、子 7→99；文件逐字节一致。打开 trace.txt，找到文件创建和读写，允许 libc 使用 openat。相同虚拟地址不证明始终对应同一物理页；trace 观测有扰动，不拿 trace 时间做性能结论。

## 渐进提示

1. 先只检查 fork 前初始化及 fork 返回值
2. 管道传的是结果，不是共享变量
3. 区分库函数、系统调用和硬件中断；不要把三者一一对应

## 扩展与失败检查

- 给父子设置不同写入值，仍检查各自私有状态
- 可自行读取 /proc/interrupts 或 /proc/softirqs 前后差值；不可读就记录原因，不能推断每次 syscall 对应一次设备中断

## 共用边界与恢复

先完成 [PI00 准备](../pi00-setup/README.md)。在仓库根目录执行命令；--out 是本实验独立输出目录。默认预算 60 秒，上限 300 秒；超时/取消会回收子进程并在 results.json 保留原因，不提高热保护阈值、不强制 root。清理时只删除自己指定的 results/piXX 目录；不要删除源文件或别的结果。

结果含环境、实际 targetId、源码与输入摘要、配置、原始数据、断言和缺失原因。将结果导入图谱 [实验结果查看器](../../index.html#/lab/eng-measurement-workbench)。导入不会升级开发者验证状态，也不自动标记节点掌握。实际 Pi 5/Linux/AArch64、Windows、其他 Linux 的记录分开；开发机/模拟器不能代替板上证据。

每次记录：预测及理由；唯一改变量；环境/种子/运行命令；原始结果文件；支持哪个解释；两个仍未排除的因素；下一次实验。至少完成一次改变量后的迁移并解释结果，再自评完成。

## 来源与适用范围

- https://man7.org/linux/man-pages/man2/fork.2.html
- https://man7.org/linux/man-pages/man1/strace.1.html

来源用于对应接口/数值方法的边界；不表示整个项目照搬官方实验。
