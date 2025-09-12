# Monitoring and Observability

## Monitoring Stack

- **Frontend Monitoring:** CLI操作日志和性能指标（本地文件日志） - _原因：CLI应用无需复杂监控，重点关注操作审计_
- **Backend Monitoring:** Winston结构化日志 + 自定义性能指标收集 - _原因：交易应用需要完整的操作追踪和性能监控_
- **Error Tracking:** 本地错误日志 + 可选Sentry集成（用户配置） - _原因：本地优先，可选择性开启云服务_
- **Performance Monitoring:** 内置性能指标收集器 + 定期报告 - _原因：监控交易延迟和系统资源使用_

## Key Metrics

**Frontend Metrics:**
- CLI命令执行时间和成功率
- 用户操作频率和模式分析
- 错误命令统计和帮助请求
- 配置变更和策略创建活动

**Backend Metrics:**
- 交易执行延迟（订单提交到确认）
- API调用成功率和响应时间
- 网格策略触发频率和盈亏统计
- 数据库查询性能和连接池状态
- 内存使用和垃圾回收性能
- 私钥访问频率和缓存命中率
