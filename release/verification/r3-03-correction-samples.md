# R3-03 CORRECTION 对比样本（离线 fallback）

- 目标：修复 `security/sync/scan-preview` 语义丢失与术语漂移。
- 样本数：3（对应本轮门禁要求中的问题类型）。

| 样本英文描述 | 修正前（旧 fallback） | 修正后（新 fallback） |
| --- | --- | --- |
| Scan and preview skills before sync to keep security guardrails. | 用于扫描技能、预览内容、同步配置、加强安全控制。 | 用于扫描并预览技能目录、同步技能配置、增强安全防护。 |
| Securely sync skills across tools with permission checks. | 用于同步配置、连接多工具流程。 | 用于同步技能配置、增强安全防护。 |
| Preview scanned skills and sync updates while reducing security risks. | 用于扫描技能、预览内容、同步配置、加强安全控制。 | 用于扫描并预览技能目录、同步技能配置、增强安全防护。 |

## 结论
- `scan+preview` 已合并为“扫描并预览技能目录”，不再语义割裂。
- `sync` 术语统一为“同步技能配置”。
- `security` 术语统一为“增强安全防护”，并覆盖 `secure/guardrail/permission/risk` 变体。
