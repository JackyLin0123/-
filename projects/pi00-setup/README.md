# PI00：共用准备，不计作第七个项目

先确认已有系统能否使用。不要为教程重刷正常系统；若确需写卡，先识别目标卡并备份原有数据。推荐兼容 Pi 5 的 64 位 Raspberry Pi OS，型号、内核架构和用户态位数分别记录。无需摄像头、HAT 或 GPIO 配件。

预测：`int a[] = {2,3,5}; int *p=a;` 中 `*p`、`a[1]` 和三项总和是多少？数组是连续元素，指针保存地址；C 的数组不会自动携带长度。试着改为 4 个元素并同时修改循环上界，解释为何越界不被语言自动拦截。编译把源码变为对象，链接把对象/库合成可执行文件。

Pi Bash：先检查现有工具；缺少时才安装，首次需要网络。

```bash
uname -m
cat /etc/os-release
python3 --version
gcc --version
```

Raspberry Pi OS 的系统工具可用 `sudo apt install build-essential strace python3-venv` 安装；不要用 pip 修改系统 Python。PI06 单独用 venv 安装 NumPy，电脑训练另装 PyTorch，不让所有项目依赖框架。

```bash
python3 projects/pi00-setup/run.py --out results/pi00
```

Windows PowerShell：已安装 C11 GCC 时，可做独立开发机 smoke。

```powershell
python -X utf8 projects/pi00-setup/run.py --out results/pi00-windows
```

可选 WSL：在 WSL 的 Linux shell 执行 Bash 命令。Windows 编译成功不表示 WSL、Linux ABI 或 Pi 已通过。

`results.json` 采集可读取的板型号、OS/内核、架构、用户态位数、内存、存储余量、编译器/Python、温度、频率、节流位和 perf/strace 存在性。自动读不到的值为 null/unknown，不填 0。模型名来自设备树，不能因 ARM64 就猜成 Pi 5。电源、线缆和散热请手工记录：额定参数/实际接法/散热器/风扇是否运行。`perf` 出现在 PATH 也不等于有访问计数器的权限。

smoke 必须得到 `sum=10,pointer_first=2`，不是只检查编译器退出。先确认 SSH 或本机终端可用；SSH 连接信息自行保管，不写进公开结果。官方电源/主动散热建议见 [Pi 5 产品说明](https://www.raspberrypi.com/products/raspberry-pi-5/) 和 [系统文档](https://www.raspberrypi.com/documentation/computers/os.html)。不关闭热保护、不强设高频、不为实验增加 swap。

共用 runner 默认 60 秒，上限 300 秒；Ctrl+C 保存取消原因并回收子进程。温度达到 80°C 或当前欠压/节流时停止性能采样。历史节流位单列，不当成本次事件。无温度/频率信息仍能做正确性检查，但不能报告环境受控的性能对比。清理只删除自己指定的 results/pi00 目录。首次准备完成后，合成输入、参考程序和站点核心无需网络；安装新包和浏览外部资料仍需要网络。

本模块开发记录为 Windows x86-64；实际 Pi、电源/散热/网络未盘点，不能标作板上准备通过。
