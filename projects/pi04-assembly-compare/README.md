# 同一段 C，两个指令集

这是本图谱原创教学组合，不是产品真实案例或论文复现。任务先于参考实现；先完成预测，再检查源码。Pi 必需分支当前待实机验证。

## 先预测

预测：sum_to(10)、branch(-7)、call(10) 的结果分别是什么？-O2 是否必须保留 call 指令？

## 运行与产物

Pi/Linux Bash：
```bash
python3 projects/pi04-assembly-compare/run.py --out results/pi04-arm
```
实际 Linux x86-64 / 可选 WSL 内用同一命令、换输出目录。Windows PowerShell 可得到独立 Windows ABI 开发结果，不能代替 Linux x86-64：
```powershell
python -X utf8 projects/pi04-assembly-compare/run.py --out results/pi04-windows
```
运行入口保存 -O0/-O2 汇编、对象文件、objdump -f/-d 及相同测试向量；CC 环境变量可选择本机原生编译器。没有第二套执行环境，保留第二目标 skipped；不要把交叉生成冒充运行。编译在临时目录进行，以避开部分 Windows binutils 对中文输出路径的限制，再复制产物。

## 核验与解释

sum_to(10)=55、branch(-7)=7、call(10)=66；0/1/10/100 和 -7 都通过。逐处标注参数/返回值/栈/循环。解释至少一处优化：可能内联、折叠或取消栈帧；汇编无需逐字匹配。对象头的目标架构与实际编译器 -dumpmachine 一致。只比较相同 OS/ABI 后才讨论 ISA 差异。

## 渐进提示

1. 先看源码测试向量，不先猜寄存器
2. 对齐相同优化级别、OS 和 ABI
3. 函数可能被内联，不能靠是否看见 call 判断结果

## 扩展与失败检查

- 为两种 Linux 目标注释参数/返回寄存器及栈规则
- 可交叉生成第二架构汇编，但记录生成成功、未执行，并附工具来源

## 共用边界与恢复

先完成 [PI00 准备](../pi00-setup/README.md)。在仓库根目录执行命令；--out 是本实验独立输出目录。默认预算 60 秒，上限 300 秒；超时/取消会回收子进程并在 results.json 保留原因，不提高热保护阈值、不强制 root。清理时只删除自己指定的 results/piXX 目录；不要删除源文件或别的结果。

结果含环境、实际 targetId、源码与输入摘要、配置、原始数据、断言和缺失原因。将结果导入图谱 [实验结果查看器](../../index.html#/lab/eng-measurement-workbench)。导入不会升级开发者验证状态，也不自动标记节点掌握。实际 Pi 5/Linux/AArch64、Windows、其他 Linux 的记录分开；开发机/模拟器不能代替板上证据。

每次记录：预测及理由；唯一改变量；环境/种子/运行命令；原始结果文件；支持哪个解释；两个仍未排除的因素；下一次实验。至少完成一次改变量后的迁移并解释结果，再自评完成。

## 来源与适用范围

- https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html
- https://developer.arm.com/documentation/102374/latest/

来源用于对应接口/数值方法的边界；不表示整个项目照搬官方实验。
