// src/controllers/scheduler.controller.js
const { db } = require('../db');
const SchedulerService = require('../services/scheduler.service');
const { isValidCron } = require('../utils/validators');

// GET /api/schedules
async function getAll(req, res, next) {
  try {
    const rows = await db('schedules').orderBy('module_id');
    const result = {};
    for (const s of rows) {
      result[s.module_id] = {
        enabled: s.enabled,
        preset: s.preset,
        cron: s.cron_expression,
        hour: String(s.run_hour),
        weekday: String(s.run_weekday),
        lastRunAt: s.last_run_at,
        nextRunAt: s.next_run_at,
      };
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// PUT /api/schedules/:moduleId
async function save(req, res, next) {
  try {
    const { moduleId } = req.params;
    const body = req.body;

    const updateData = {
      updated_at: new Date(),
    };

    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.preset !== undefined) updateData.preset = body.preset;
    if (body.cron !== undefined) {
      if (body.cron && !isValidCron(body.cron)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_CRON', message: `Invalid cron: ${body.cron}` } });
      }
      updateData.cron_expression = body.cron;
    }
    if (body.hour !== undefined) updateData.run_hour = parseInt(body.hour, 10) || 0;
    if (body.weekday !== undefined) updateData.run_weekday = parseInt(body.weekday, 10) || 0;

    await db('schedules').where({ module_id: moduleId }).update(updateData);

    // Update scheduler service
    const schedule = await db('schedules').where({ module_id: moduleId }).first();
    await SchedulerService.update(moduleId, {
      enabled: schedule.enabled,
      cron_expression: schedule.cron_expression,
    });

    res.json({ success: true, message: `Schedule updated for ${moduleId}` });
  } catch (err) { next(err); }
}

// PATCH /api/schedules/:moduleId/toggle
async function toggle(req, res, next) {
  try {
    const { moduleId } = req.params;
    const schedule = await db('schedules').where({ module_id: moduleId }).first();
    if (!schedule) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });

    const newEnabled = !schedule.enabled;
    await db('schedules').where({ module_id: moduleId }).update({ enabled: newEnabled, updated_at: new Date() });

    await SchedulerService.update(moduleId, {
      enabled: newEnabled,
      cron_expression: schedule.cron_expression,
    });

    res.json({ success: true, data: { enabled: newEnabled } });
  } catch (err) { next(err); }
}

// POST /api/schedules/:moduleId/run  (Run Now)
async function runNow(req, res, next) {
  try {
    const { moduleId } = req.params;
    const result = await SchedulerService.runNow(moduleId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// GET /api/schedules/:moduleId/logs
async function getLogs(req, res, next) {
  try {
    const { moduleId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [logs, [{ count }]] = await Promise.all([
      db('sync_logs')
        .where({ module_id: moduleId })
        .orderBy('started_at', 'desc')
        .limit(limit)
        .offset(offset),
      db('sync_logs').where({ module_id: moduleId }).count('id as count'),
    ]);

    res.json({
      success: true,
      data: {
        logs: logs.map(l => ({
          id: l.id,
          triggerType: l.trigger_type,
          status: l.status,
          startedAt: l.started_at,
          finishedAt: l.finished_at,
          duration: l.finished_at ? new Date(l.finished_at) - new Date(l.started_at) : null,
          recordsSent: l.records_sent,
          recordsFailed: l.records_failed,
          errorMessage: l.error_message,
        })),
        pagination: {
          page,
          limit,
          total: parseInt(count, 10),
          totalPages: Math.ceil(parseInt(count, 10) / limit),
        },
      },
    });
  } catch (err) { next(err); }
}

module.exports = { getAll, save, toggle, runNow, getLogs };
