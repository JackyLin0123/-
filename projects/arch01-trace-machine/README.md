# ARCH01：从指令语义到周期轨迹

本站原创离线项目。先写手算，再运行参考实现，最后换输入做迁移。浏览器教学模拟和Node实跑验证的是声明模型，不能代表实机CPU性能或完整RISC-V兼容性。

## 任务与模型

只支持`add/sub/addi/lw/sw/beq/jal/jalr`文本子集，32个32位寄存器，x0恒0，固定4字节指令。加减取低32位。256字节小端数据内存，读写必须4字节对齐；立即数按相应RV32I编码范围检查；未知指令、越界和非法对齐均报错。不含乘法、压缩、CSR、特权模式、机器码汇编/解码。`jalr`文本格式为`jalr x0,x1,0`。

PC等于程序末地址时停止，这是项目约定。分支/jal相对当前PC，jalr先用旧源值计算并清最低位，再写PC+4；不对齐仍报错。顺序执行最多256步，流水最多512周期。访存失败不提交这条顺序指令的副作用。

流水为IF/ID/EX/MEM/WB，分离指令/数据存储器，数据访存一周期，同拍寄存器先写后读；完整转发含EX/MEM及MEM/WB到EX（包括store数据）。load-use一拍停顿。静态预测不跳转，EX或MEM末决议可切换；被冲刷指令不得写内存/寄存器。不实现乱序、精确异常、真实Cache stall或电气时序。

## 先手算

1. fixtures.json 的lw/add/add从x2=0、x4=2、x6=3、[0]=7开始。画PC和寄存器表，标出load-use停顿与两处转发。
2. 写出完整转发8拍、关闭转发11拍的时空图。说明寄存器“同拍先写后读”在计算中用在哪里。
3. branch样例说明为什么错误路径store不能写[4]，比较EX/MEM决议的flush槽数。
4. Cache四行、4B块，0,4,0,16,0手算tag/index/offset，预期1次命中4次缺失。再比较W0/W16在写回+分配和写直达+不分配下的下层写事务。

## 可运行命令与产物

在仓库根运行，Python标准库与Node.js即可，无npm安装。实际开发机验证版本保存于结果environment；本次使用Node v24.19.0与Python 3.11.1。

```powershell
python -B -X utf8 projects/arch01-trace-machine/run.py --out results/arch01-trace-machine
```

run.py复制精确声明源码/输入到全新临时目录后运行Node验证，30秒超时回收子进程；输出results.json、原始stdout/stderr、sequential-trace.json和pipeline-cycles.json。结果包含来源摘要、命令、环境、种子、单位与逐项断言。源码变更后旧摘要自然失效，应重跑再登记。可以把results.json导入图谱实验工作台；导入不自动认证节点掌握。

验证分别使用顺序语义、独立流水执行，以及另写的指令索引整数oracle。固定种子160个程序覆盖算术、load/store、前向分支，比较所有寄存器/内存/最终PC；另固定覆盖jal/jalr、错误路径store、非法输入与循环预算。穷举全部八位加减输入和256条八位FSM序列。测试不能证明未覆盖的完整ISA、硬件时序或真实设备行为。

## 迁移、失败与提交材料

- 将第二条add改为不依赖load，先预测拍数再核对；预期降为7拍。
- 用`jalr x5,x5,0`测试同源同目的寄存器，先记录旧x5、返回地址及目标。
- Cache改为2路、修改写分配，分别记录命中、脏淘汰、下层写事务与字节数；结束不自动flush。
- 先提交MODEL.md形式的模型说明、两张手算表和失败预测，再附原始运行结果及一处解释修订。不要只交绿灯截图。

清理只删除自己指定的结果目录；源码和他人结果保留。项目通过仅表示这一开发机上的明确教学模型验证成功。

## 核对来源

- [RV32I 2.1，v20260120](https://docs.riscv.org/reference/isa/v20260120/unpriv/rv32.html)：指令状态转移与对齐边界。
- [MIT 6.004 Spring 2017课表](https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/pages/calendar/)：机制主题组织；本站项目不冒充官方实验。
- [RISC-V psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/)：整数寄存器约定；整体文档2.0-rc0预发布，项目不实现完整ABI工具链。
