const express = require('express');
const router = express.Router();

// In-memory task storage
let scheduledTasks = [
  {
    id: 1,
    name: 'Daily Device Health Check',
    description: 'Check all devices connectivity and health status',
    task_type: 'health_check',
    device_ids: [1, 2, 3],
    schedule: '0 8 * * *',
    enabled: true,
    created_by: 1,
    created_at: new Date('2024-01-20').toISOString(),
  },
  {
    id: 2,
    name: 'Weekly Backup',
    description: 'Create configuration backup for all devices',
    task_type: 'backup',
    device_ids: [1, 2],
    schedule: '0 2 * * 0',
    enabled: true,
    created_by: 1,
    created_at: new Date('2024-02-01').toISOString(),
  },
  {
    id: 3,
    name: 'Nightly Reboot',
    description: 'Scheduled reboot for maintenance',
    task_type: 'reboot',
    device_ids: [3],
    schedule: '0 3 * * *',
    enabled: false,
    created_by: 1,
    created_at: new Date('2024-03-01').toISOString(),
  },
];

let taskExecutions = [
  {
    id: 1,
    task_id: 1,
    status: 'success',
    started_at: new Date('2024-03-10T08:00:00').toISOString(),
    completed_at: new Date('2024-03-10T08:02:15').toISOString(),
    result: { checked: 3, healthy: 3, warnings: 0 },
    error_message: null,
    device_id: 1,
  },
  {
    id: 2,
    task_id: 1,
    status: 'success',
    started_at: new Date('2024-03-11T08:00:00').toISOString(),
    completed_at: new Date('2024-03-11T08:01:45').toISOString(),
    result: { checked: 3, healthy: 2, warnings: 1 },
    error_message: null,
    device_id: 1,
  },
  {
    id: 3,
    task_id: 2,
    status: 'failed',
    started_at: new Date('2024-03-10T02:00:00').toISOString(),
    completed_at: new Date('2024-03-10T02:00:30').toISOString(),
    result: null,
    error_message: 'Device 2 unreachable during backup',
    device_id: 2,
  },
];

let taskQueue = [];
let nextTaskId = 4;
let nextExecutionId = 4;

const VALID_TASK_TYPES = [
  'reboot',
  'config_update',
  'backup',
  'health_check',
  'metric_collection',
  'custom_script',
];

// GET /api/tasks - List all tasks
router.get('/', async (req, res) => {
  try {
    if (req.pool) {
      const result = await req.pool.query(
        'SELECT * FROM scheduled_tasks ORDER BY created_at DESC'
      );
      return res.json(result.rows);
    }
    res.json(scheduledTasks);
  } catch (err) {
    console.error(err);
    res.json(scheduledTasks);
  }
});

// GET /api/tasks/queue - View task queue
router.get('/queue', async (req, res) => {
  try {
    res.json(taskQueue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task queue' });
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = scheduledTasks.find((t) => t.id === parseInt(id));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks - Create scheduled task
router.post('/', async (req, res) => {
  try {
    const { name, description, task_type, device_ids, schedule, enabled } = req.body;

    if (!name || !task_type || !device_ids || !schedule) {
      return res.status(400).json({
        error: 'name, task_type, device_ids and schedule are required',
      });
    }

    if (!VALID_TASK_TYPES.includes(task_type)) {
      return res.status(400).json({
        error: `Invalid task_type. Must be one of: ${VALID_TASK_TYPES.join(', ')}`,
      });
    }

    if (!Array.isArray(device_ids) || device_ids.length === 0) {
      return res.status(400).json({ error: 'device_ids must be a non-empty array' });
    }

    const task = {
      id: nextTaskId++,
      name,
      description: description || '',
      task_type,
      device_ids,
      schedule,
      enabled: enabled !== undefined ? enabled : true,
      created_by: req.user ? req.user.userId : 1,
      created_at: new Date().toISOString(),
    };

    if (req.pool) {
      const result = await req.pool.query(
        `INSERT INTO scheduled_tasks (name, description, task_type, device_ids, schedule, enabled, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
        [name, description || '', task_type, JSON.stringify(device_ids), schedule, task.enabled, task.created_by]
      );
      return res.status(201).json(result.rows[0]);
    }

    scheduledTasks.push(task);
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = scheduledTasks.find((t) => t.id === parseInt(id));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { name, description, task_type, device_ids, schedule, enabled } = req.body;

    if (name !== undefined) task.name = name;
    if (description !== undefined) task.description = description;
    if (task_type !== undefined) task.task_type = task_type;
    if (device_ids !== undefined) task.device_ids = device_ids;
    if (schedule !== undefined) task.schedule = schedule;
    if (enabled !== undefined) task.enabled = enabled;

    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idx = scheduledTasks.findIndex((t) => t.id === parseInt(id));
    if (idx === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }
    scheduledTasks.splice(idx, 1);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// GET /api/tasks/:id/history - Task execution history
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = taskExecutions.filter((e) => e.task_id === parseInt(id));
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task history' });
  }
});

// POST /api/tasks/:id/run - Run task immediately
router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const task = scheduledTasks.find((t) => t.id === parseInt(id));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const execution = {
      id: nextExecutionId++,
      task_id: parseInt(id),
      status: 'running',
      started_at: new Date().toISOString(),
      completed_at: null,
      result: null,
      error_message: null,
      device_id: task.device_ids[0],
    };

    taskExecutions.push(execution);
    taskQueue.push({ ...execution, task_name: task.name });

    // Simulate task execution
    setTimeout(() => {
      const e = taskExecutions.find((x) => x.id === execution.id);
      if (e) {
        e.status = 'success';
        e.completed_at = new Date().toISOString();
        e.result = { message: `${task.task_type} completed successfully` };
        taskQueue.splice(taskQueue.findIndex((q) => q.id === execution.id), 1);
      }
    }, 3000);

    res.status(202).json({ message: 'Task queued for execution', execution });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to run task' });
  }
});

module.exports = router;
