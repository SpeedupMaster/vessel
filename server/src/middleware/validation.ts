import { Request, Response, NextFunction, Router } from 'express';
import YAML from 'yaml';
import cron from 'node-cron';

export class BadRequest extends Error { status = 400; }

export function checkedRouter() {
  const router = Router();
  // Express 4 does not forward rejected route promises automatically.
  for (const method of ['get', 'post', 'put', 'delete'] as const) {
    const register = router[method].bind(router);
    (router as any)[method] = (path: string, ...handlers: any[]) => register(path, ...handlers.map(handler =>
      (req: Request, res: Response, next: NextFunction) => {
        try { Promise.resolve(handler(req, res, next)).catch(next); } catch (error) { next(error); }
      }));
  }
  return router;
}

export function validateDomain(domain: unknown) {
  if (typeof domain !== 'string' || domain.length > 253 || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
    throw new BadRequest('请输入有效的域名，不包含协议、端口或路径');
  }
}

export function validateCompose(value: unknown) {
  if (typeof value !== 'string') throw new BadRequest('Compose must be a string');
  let parsed: any;
  try { parsed = YAML.parse(value); } catch { throw new BadRequest('Invalid Compose YAML'); }
  if (!parsed?.services || typeof parsed.services !== 'object' || Array.isArray(parsed.services) || !Object.keys(parsed.services).length) {
    throw new BadRequest('Compose must define at least one service');
  }
  for (const [name, config] of Object.entries(parsed.services)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name) || !config || typeof config !== 'object' || Array.isArray(config)) throw new BadRequest('Invalid Compose service');
  }
}

export function validateRequest(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.path.endsWith('/restore-file')) return next();
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) throw new BadRequest('Expected a JSON object');
    const strings = ['name', 'description', 'composeYaml', 'envContent', 'id', 'domain', 'appId', 'serviceName', 'endpoint', 'bucketName', 'accessKeyId', 'secretAccessKey', 'server', 'username', 'token', 'command', 'databaseName'];
    for (const field of strings) if (body[field] !== undefined && typeof body[field] !== 'string') throw new BadRequest(`${field} must be a string`);
    for (const field of ['enabled', 'autoUpdate', 'autoPrune', 'pruneDangling', 'pruneBuilderCache', 'autoCheckUpdates', 'runNow']) {
      if (body[field] !== undefined && typeof body[field] !== 'boolean') throw new BadRequest(`${field} must be a boolean`);
    }
    for (const field of ['cronSchedule', 'pruneSchedule', 'checkSchedule']) {
      if (body[field] !== undefined && (typeof body[field] !== 'string' || !cron.validate(body[field]))) throw new BadRequest(`Invalid ${field}`);
    }
    for (const field of ['retentionCount', 'unusedRetentionHours', 'targetPort']) {
      const max = field === 'targetPort' ? 65535 : 10000;
      if (body[field] !== undefined && (!Number.isInteger(Number(body[field])) || Number(body[field]) < 1 || Number(body[field]) > max)) throw new BadRequest(`Invalid ${field}`);
    }
    if (body.composeYaml !== undefined) validateCompose(body.composeYaml);
    if (body.domain !== undefined) validateDomain(body.domain);
    if (body.serviceName !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(body.serviceName)) throw new BadRequest('Invalid service name');
    if (body.targetType !== undefined && !['internal', 'host'].includes(body.targetType)) throw new BadRequest('Invalid target type');
    if (body.mode !== undefined && !['db', 'shell'].includes(body.mode)) throw new BadRequest('Invalid execution mode');
    if (body.service !== undefined && (typeof body.service !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(body.service))) throw new BadRequest('Invalid service');
    if (body.domainBinding !== undefined) {
      if (!body.domainBinding || typeof body.domainBinding !== 'object' || Array.isArray(body.domainBinding)) throw new BadRequest('Invalid domain binding');
      validateDomain(body.domainBinding.domain);
      const port = Number(body.domainBinding.targetPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new BadRequest('Invalid target port');
      if (body.domainBinding.serviceName !== undefined && (typeof body.domainBinding.serviceName !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(body.domainBinding.serviceName))) throw new BadRequest('Invalid service name');
      if (body.domainBinding.targetType !== undefined && !['internal', 'host'].includes(body.domainBinding.targetType)) throw new BadRequest('Invalid target type');
    }
    if (body.schedule !== undefined) {
      const schedule = body.schedule;
      if (!schedule || typeof schedule !== 'object' || typeof schedule.enabled !== 'boolean' ||
        typeof schedule.cronSchedule !== 'string' || !cron.validate(schedule.cronSchedule) ||
        (schedule.targetDatabase !== undefined && typeof schedule.targetDatabase !== 'string') ||
        (schedule.retentionCount !== undefined && (!Number.isInteger(Number(schedule.retentionCount)) || Number(schedule.retentionCount) < 1 || Number(schedule.retentionCount) > 10000))) throw new BadRequest('Invalid backup schedule');
    }
    next();
  } catch (error) { next(error); }
}

export function apiErrorHandler(error: any, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  console.error('[API]', error.message);
  res.status(status).json({ error: status === 500 ? '操作失败，请查看服务端日志' : error.message });
}
