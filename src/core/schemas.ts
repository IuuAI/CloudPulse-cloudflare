import { z } from 'zod';

export const NodeStatusEnum = z.enum(['online', 'degraded', 'offline', 'healthy', 'maintenance']);
export const ServiceStatusEnum = z.enum(['operational', 'degraded', 'down', 'maintenance']);
export const IncidentStatusEnum = z.enum(['investigating', 'identified', 'monitoring', 'resolved']);
export const IncidentSeverityEnum = z.enum(['critical', 'major', 'minor', 'info']);

export const CreateNodeSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().min(1, '节点名称不能为空').max(100),
  region: z.string().min(1, '节点区域不能为空').max(100),
  ip: z.string().max(64).optional(),
  status: NodeStatusEnum.optional().default('healthy'),
  cpu: z.number().min(0).max(100).optional().default(0),
  ram: z.number().min(0).max(100).optional().default(0),
  disk: z.number().min(0).max(100).optional().default(0),
  ping: z.number().min(0).max(5000).optional().default(20),
  networkIn: z.string().max(50).optional().default('0 B'),
  networkOut: z.string().max(50).optional().default('0 B'),
  uptime: z.number().min(0).max(100).optional().default(100),
  os: z.string().max(100).optional().default('Linux'),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
});

export const UpdateNodeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  region: z.string().min(1).max(100).optional(),
  ip: z.string().max(64).optional(),
  status: NodeStatusEnum.optional(),
  cpu: z.number().min(0).max(100).optional(),
  ram: z.number().min(0).max(100).optional(),
  disk: z.number().min(0).max(100).optional(),
  ping: z.number().min(0).max(5000).optional(),
  networkIn: z.string().max(50).optional(),
  networkOut: z.string().max(50).optional(),
  uptime: z.number().min(0).max(100).optional(),
  os: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const CreateServiceSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().min(1, '服务名称不能为空').max(100),
  category: z.string().min(1).max(50).optional().default('API'),
  status: ServiceStatusEnum.optional().default('operational'),
  latency: z.number().min(0).max(10000).optional().default(25),
  uptime: z.number().min(0).max(100).optional().default(99.9),
  uptime30d: z.number().min(0).max(100).optional().default(99.9),
  url: z.string().max(500).optional().default(''),
  description: z.string().max(500).optional().default(''),
});

export const UpdateServiceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  status: ServiceStatusEnum.optional(),
  latency: z.number().min(0).max(10000).optional(),
  uptime: z.number().min(0).max(100).optional(),
  uptime30d: z.number().min(0).max(100).optional(),
  url: z.string().max(500).optional(),
  description: z.string().max(500).optional(),
});

export const CreateIncidentSchema = z.object({
  title: z.string().min(1, '故障标题不能为空').max(150),
  severity: IncidentSeverityEnum.optional().default('minor'),
  description: z.string().max(2000).optional().default('Incident reported.'),
  affectedServices: z.array(z.string().max(100)).max(50).optional().default([]),
});

export const AddIncidentUpdateSchema = z.object({
  status: IncidentStatusEnum.optional(),
  message: z.string().min(1, '更新内容不能为空').max(2000),
});

export const ResolveIncidentSchema = z.object({
  message: z.string().max(2000).optional().default('Incident resolved.'),
});

export const ProbeReportSchema = z.object({
  token: z.string().min(8, '探针 Token 无效').max(256),
  cpu: z.number().min(0).max(100).optional(),
  ram: z.number().min(0).max(100).optional(),
  disk: z.number().min(0).max(100).optional(),
  ping: z.number().min(0).max(10000).optional(),
  networkIn: z.union([z.string(), z.number()]).optional(),
  networkOut: z.union([z.string(), z.number()]).optional(),
});

export const AdminVerifySchema = z.object({
  password: z.string().min(1, '管理员密码不能为空'),
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, '原密码不能为空'),
  newPassword: z.string().min(6, '新密码长度至少需要 6 位字符').max(128),
});

export const GenerateProbeScriptSchema = z.object({
  nodeId: z.string().min(1, '节点 ID 不能为空').max(64),
});

export const TelegramConfigSchema = z.object({
  enabled: z.boolean().optional(),
  botToken: z.string().max(200).optional(),
  chatId: z.string().max(100).optional(),
  alertOnStatusChange: z.boolean().optional(),
  alertOnHighLoad: z.boolean().optional(),
  alertOnIncident: z.boolean().optional(),
  dailyDigest: z.boolean().optional(),
  digestTime: z.string().max(20).optional(),
});

export const QuotaSettingsSchema = z.object({
  d1ReadLimitDaily: z.number().min(1000).optional(),
  d1WriteLimitDaily: z.number().min(1000).optional(),
  kvReadLimitDaily: z.number().min(1000).optional(),
  kvWriteLimitDaily: z.number().min(1000).optional(),
  historyRetentionDays: z.number().min(1).max(365).optional(),
  checkIntervalMinutes: z.number().min(1).max(1440).optional(),
  autoPruneEnabled: z.boolean().optional(),
});
