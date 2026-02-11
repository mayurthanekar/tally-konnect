// src/services/scheduler.service.js
// Dynamic cron job management - registers/unregisters based on DB config
const cron = require('node-cron');
const { db } = require('../db');
const SyncEngine = require('./sync.engine');
const logger = require('../utils/logger');

// Active cron jobs registry
const activeJobs = new Map();

class SchedulerService {
  /**
   * Initialize all enabled schedules on app startup
   */
  static async init() {
    try {
      const schedules = await db('schedules').where({ enabled: true });
      logger.info({ count: schedules.length }, 'Initializing schedules');

      for (const schedule of schedules) {
        SchedulerService.register(schedule);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to initialize scheduler');
    }
  }

  /**
   * Register a cron job for a module
   */
  static register(schedule) {
    const { module_id, cron_expression } = schedule;

    // Unregister existing job first
    SchedulerService.unregister(module_id);

    if (!cron_expression || !cron.validate(cron_expression)) {
      logger.warn({ module_id, cron_expression }, 'Invalid cron expression, skipping');
      return false;
    }

    const job = cron.schedule(cron_expression, async () => {
      logger.info({ module_id, cron: cron_expression }, 'Scheduled sync triggered');
      try {
        await SyncEngine.run(module_id, 'scheduled');

        // Update next_run_at
        await db('schedules').where({ module_id }).update({
          last_run_at: new Date(),
        });
      } catch (err) {
        logger.error({ module_id, err }, 'Scheduled sync error');
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    });

    activeJobs.set(module_id, job);
    logger.info({ module_id, cron: cron_expression }, 'Cron job registered');
    return true;
  }

  /**
   * Unregister a cron job
   */
  static unregister(moduleId) {
    const existing = activeJobs.get(moduleId);
    if (existing) {
      existing.stop();
      activeJobs.delete(moduleId);
      logger.info({ moduleId }, 'Cron job unregistered');
    }
  }

  /**
   * Update a schedule (called when user changes config)
   */
  static async update(moduleId, scheduleData) {
    if (scheduleData.enabled && scheduleData.cron_expression) {
      SchedulerService.register({
        module_id: moduleId,
        cron_expression: scheduleData.cron_expression,
      });
    } else {
      SchedulerService.unregister(moduleId);
    }
  }

  /**
   * Run a module immediately (manual trigger)
   */
  static async runNow(moduleId) {
    return SyncEngine.run(moduleId, 'manual');
  }

  /**
   * Get status of all active jobs
   */
  static getStatus() {
    const status = {};
    for (const [moduleId, job] of activeJobs) {
      status[moduleId] = { active: true };
    }
    return status;
  }

  /**
   * Shutdown all cron jobs (for graceful shutdown)
   */
  static shutdown() {
    for (const [moduleId, job] of activeJobs) {
      job.stop();
    }
    activeJobs.clear();
    logger.info('All cron jobs stopped');
  }
}

module.exports = SchedulerService;
