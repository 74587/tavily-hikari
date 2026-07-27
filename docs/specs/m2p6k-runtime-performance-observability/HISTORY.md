# History：性能诊断日志与低内存稳定运行合同（#m2p6k）

## 关键演进

- 2026-06-23：创建程序级 spec，冻结“PR1 只补默认结构化性能日志与验证基建、PR2 再收口
  bounded-memory 与 `256MiB` 合同”的执行边界。
- 2026-06-23：runtime logging 扩展出 cgroup/进程组内存快照字段，默认日志开始覆盖 HA
  export/import/sync、dashboard snapshot、recent request reads、forward-proxy startup。
- 2026-06-23：owner-facing 重读路径开始输出 `low_memory_protection_decision` 结构化事件，
  先记录当前 verdict，作为 PR2 真实低内存退化动作的前置证据面。
- 2026-06-23：request/token logs perf 事件从误用的 `WARN` 口径收回到默认 `INFO`，避免把
  正常完成的诊断事件伪装成异常告警。

## 相关规范

- `docs/specs/f36b4-edgeone-active-standby-ha/SPEC.md`
- `docs/specs/66t8u-admin-dashboard-overview-performance/SPEC.md`
- `docs/specs/ev4td-admin-recent-requests-performance-copy/SPEC.md`
- Corrected HA perf diagnostics so full-master export without a peer does not synthesize a zero
  ACK watermark; expensive outbox and memory sampling remains bounded to the existing slow/error
  and time-window triggers.
