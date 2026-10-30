# 电脑训练，Pi 上可验证推理

这是本图谱原创教学组合，不是产品真实案例或论文复现。任务先于参考实现；先完成预测，再检查源码。Pi 必需分支当前待实机验证。

## 先预测

预测：只复制权重，不复制训练集拟合的标准化参数，Pi 与电脑预测会怎样变化？

## 运行与产物

电脑 Windows PowerShell（建议 venv；固定版本是开发环境基准，尚未代表 Pi wheel 实测）：
```powershell
python -m venv .venv-pi-training
.venv-pi-training/Scripts/python -m pip install -r projects/pi06-edge-inference/requirements-train.txt
.venv-pi-training/Scripts/python projects/pi06-edge-inference/train.py --out results/pi06/model.json
.venv-pi-training/Scripts/python projects/pi06-edge-inference/run.py --model results/pi06/model.json --out results/pi06/computer
```
Pi Bash：传输 model.json 和 pi06-edge-inference/pi-common 源目录，只有 NumPy 推理：
```bash
python3 -m venv .venv-pi
.venv-pi/bin/python -m pip install -r projects/pi06-edge-inference/requirements-pi.txt
.venv-pi/bin/python projects/pi06-edge-inference/run.py --model results/pi06/model.json --out results/pi06/pi
```
离线运行前先安装依赖。固定 seed=17，128 训练样本与 8 独立测试样本；仅训练集拟合 mean/std，PyTorch 线性回归 250 步。安全 JSON 导出，不用 pickle；包含权重、偏置、标准化、顺序/形状/dtype、测试输入、参考预测、格式版本和 SHA-256。

## 核验与解释

输入/预处理摘要一致；预先固定 atol=1e-6、rtol=1e-5，NumPy 与 PyTorch 同输入预测比较，单样本与批量一致。报告原始耗时及 p50/p95；warm forward 不含加载，另报 JSON 加载+验证+首次前向，明确不含解释器/NumPy 导入。tracemalloc 是 Python 追踪分配，不是总 RSS 或 NumPy 原生内存。篡改权重/scale、错误版本/形状会被拒绝；SHA-256 用于一致性，不是来源防伪。Pi 不装 CUDA，不承诺加速。

## 渐进提示

1. 先对齐 featureOrder 和 float32
2. 标准化只用训练集，不能在 Pi 再拟合测试数据
3. 先查模型摘要和输入摘要，再研究误差；不能为通过测试事后放宽容差

## 扩展与失败检查

- 固定其他条件改变 batch 大小，保存不同配置
- 比较导出模型的单样本/批量结果；可选 ONNX 等后端需另验证安装与误差，不能预先标 ARM 已支持

## 共用边界与恢复

先完成 [PI00 准备](../pi00-setup/README.md)。在仓库根目录执行命令；--out 是本实验独立输出目录。默认预算 60 秒，上限 300 秒；超时/取消会回收子进程并在 results.json 保留原因，不提高热保护阈值、不强制 root。清理时只删除自己指定的 results/piXX 目录；不要删除源文件或别的结果。

结果含环境、实际 targetId、源码与输入摘要、配置、原始数据、断言和缺失原因。将结果导入图谱 [实验结果查看器](../../index.html#/lab/eng-measurement-workbench)。导入不会升级开发者验证状态，也不自动标记节点掌握。实际 Pi 5/Linux/AArch64、Windows、其他 Linux 的记录分开；开发机/模拟器不能代替板上证据。

每次记录：预测及理由；唯一改变量；环境/种子/运行命令；原始结果文件；支持哪个解释；两个仍未排除的因素；下一次实验。至少完成一次改变量后的迁移并解释结果，再自评完成。

## 来源与适用范围

- https://docs.pytorch.org/docs/stable/generated/torch.nn.Linear.html
- https://numpy.org/doc/stable/reference/generated/numpy.allclose.html

来源用于对应接口/数值方法的边界；不表示整个项目照搬官方实验。
