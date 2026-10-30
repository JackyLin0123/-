# 自定义梯度与性能观察

## 问题与假设
导数正确是性能比较的前提。为x³实现正确反向3x²，再故意漏掉系数3，让gradcheck拒绝错误导数。不要在不可导点用有限差分结论替代数学分析。

## 数值等价后再观察性能
同一固定32样本标量线性回归，float64、SGD lr=0.1、12步。基线逐样本Python循环与向量化损失在同样初始值下训练；先断言全部损失和最终参数数值相等，再计时。每条路径先warm-up一次，再分别测量五次完整创建和训练流程。允许没有加速，不跨机器外推。

## Profiler协议与产物
CPU、单线程，在单独一轮记录data / forward_loss / backward / optimizer_step及算子。保存真实Chrome trace、聚合事件和无Profiler的重复计时。CPU data范围仅是固定张量引用，不代表真实磁盘或DataLoader开销；CPU项目不推导GPU同步耗时。父子事件总耗时重叠，不能直接求和。Profiler有观测开销。

## 最小验收
正确导数通过、错误导数失败；两实现数值一致；trace包含四个命名范围且摘要可追溯；对照未带Profiler的五次计时，并记录离散程度。浏览器实验展示此次预录摘要，不是在线PyTorch。

## 渐进提示与扩展
先手算0.7处梯度1.47；检查反向是否乘上游梯度；再检查训练曲线；最后看trace。扩展改变batch大小或重写一个明确热点，重新检查语义与重复计时。不要只选最快一次，也不要把嵌套总时间当可加的占比。

## 环境与运行

CPU、Python 3.11、PyTorch 2.9.1+cpu已验证，单线程。进入本项目目录执行 `python run.py --out results`。可在独立虚拟环境安装 `requirements-verified.txt`；普通 requirements 为兼容范围，其他版本须重验。无外部数据和平台账户。

本机运行段耗时 17.60 秒（不含 Python/PyTorch 导入与安装）；峰值进程工作集约 257.1 MiB，含框架运行时。系统负载会改变时间，不承诺其他机器相同。

产物为 `results/results.json` 和 `results/trace.json`。参考实跑记录在仓库 `_build/verify/p06-gradcheck-profile/`；源码及结果保留摘要。

## 实践记录模板

- 预测与理由：
- 唯一改变的变量、seed、环境：
- 基线与各条件完整结果：
- 失败与反例：
- 作品路径、结论边界与下一步：


参考：https://docs.pytorch.org/tutorials/recipes/recipes/profiler_recipe.html
