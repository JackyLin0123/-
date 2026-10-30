# Pi 实验结果协议与运行边界

`runtime.py` 只用 Python 标准库，负责预算、C 编译、进程回收、环境采集、测量前后温度/频率/节流和结果写入。所有实验保持独立 --out；不会操作真实浏览器学习进度。

结果协议 v1：

- `schemaVersion=1`，`projectId`、`projectRevision=1`、实际 `targetId`、随机 `runId` 和 UTC `recordedAt`。
- `status` 为 passed/failed/skipped/cancelled；`origin=measured` 只表示程序确实在该环境采集，不保证环境来自 Pi，也不是真实性签名。
- `environment` 记录 OS/内核/设备/架构/用户态位数/依赖，未知为 null 或明确 unknown。架构优先使用实际平台报告；Windows 另读 GetSystemInfo/GetNativeSystemInfo，分别记录进程与原生架构、来源，未知回退 unspecified，不凭用户态 64 位推断 x86。实际设备树型号含 Raspberry Pi 5、Linux、AArch64 同时成立才分配 pi5-linux-aarch64；否则保留实际平台名。
- `sourceManifest` 为相对仓库路径及 SHA-256，包含项目 Python/C/README/依赖清单和共用 runtime；`inputManifest` 对仓库内输入记录仓库相对路径、SHA-256 及 scope=repository；外部用户输入明确标 scope=external 与 external/文件名，不伪装成已核验仓库文件。运行参数放 `config`，命令放 `command`。
- `events` 是可选原始事件，也通过 `measurements` 中的 events 视图提供；sequence 是操作记录顺序，不是精确时间戳。
- `measurements[]` 每项含 `name/type/unit/data`；type 为 events/samples/groups，data 为对象数组。不得混用 ns、ns/access、bytes 等单位。原始重复与聚合分开，保留重复数。
- `assertions[]` 为 name/passed/detail；`missing[]` 为 metric/status/reason。跳过与缺失指标不伪装成零。`thermal` 记录前/中/后，current/historical 分开；`performanceStatus` 标 valid/affected/insufficient-information。

共同可视化 ID：`eng-measurement-workbench`。一次导入不证明真实性，学习自评与开发者验证独立。运行本地文件不上传，不修改项目登记的验证状态。每份结果应单独保管，分享前去除不必要的本地路径/私网 IP；公开站点使用安全导出器处理证据副本。

编译在私有临时目录进行，避免部分 Windows binutils 不支持中文输出目录；Python 复制源码和产物，退出时清理临时目录。不会递归清理源仓库。POSIX 子进程另建进程组，取消/超时回收；Windows 将当前实验进程加入 kill-on-close Job Object，回收它及未来创建的子进程，包括编译器启动的汇编/链接子进程。PI01 服务自动关闭。不可用的平台写 skipped+reason，不跨平台猜测通过。
