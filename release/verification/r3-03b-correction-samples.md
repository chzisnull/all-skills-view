# R3-03B CORRECTION 对比样本（离线 fallback）

- 目标：补齐 `security/sync/scan-preview` 语义模板，并统一 smart/fallback 术语。
- 样本数：3（覆盖本轮门禁问题类型）。

| 样本英文描述 | 修正前（旧 fallback） | 修正后（R3-03B） |
| --- | --- | --- |
| Scan and preview skills before sync to keep security guardrails. | 用于扫描技能、预览内容、同步配置、加强安全控制。 | 用于扫描并预览技能目录、跨工具同步技能配置，并提供增强安全防护。 |
| Securely sync skills across tools with permission checks. | 用于同步配置、连接多工具流程。 | 用于跨工具同步技能配置，并提供增强安全防护。 |
| Preview scanned skills and sync updates while reducing security risks. | 用于扫描技能、预览内容、同步配置、加强安全控制。 | 用于扫描并预览技能目录、跨工具同步技能配置，并提供增强安全防护。 |

## 结论
- 离线 fallback 已内置语义模板：scan+preview+sync+security、sync+security、scan+preview+security。
- 术语统一为“跨工具同步技能配置”“增强安全防护”“扫描并预览技能目录”。
- smart 输出统一经过同一术语归一化，消除“跨工具同步配置”等术语漂移。
