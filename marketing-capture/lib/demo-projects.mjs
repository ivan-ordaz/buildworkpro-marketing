// Stage a coherent schedule on a seeded demo project before it is filmed.
//
// The seed drops tasks into phases at random ("Charge refrigerant" under
// Planning & Permits, "Submit permit application" under Installation), gives
// every task in a phase the phase's exact dates with a 1-day duration, links
// no dependencies, and leaves `originalContractValue` empty. On camera that
// reads as a nonsense job and a Gantt of identical stripes. This replaces a
// project's phases and tasks with a real sequence, dated relative to today so
// the "today" line always lands mid-job, wired with dependencies, and anchors
// the original contract on the revised value the seed did set.
//
// Idempotent: existing phases and tasks (including ones a scene adds on
// camera) are soft-deleted and rebuilt on every run.

const DAY = 86400000;

function startOfToday() {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

function at(offsetDays) {
  return new Date(startOfToday().getTime() + offsetDays * DAY);
}

// Offsets are relative to whatever day the scene runs, so roll anything that
// lands on a weekend forward to Monday — nobody books an inspection on a Sunday.
function weekday(date) {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6) d.setTime(d.getTime() + DAY);
  return d;
}

function workdays(from, to) {
  let n = 0;
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const dow = new Date(t).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return Math.max(n, 1);
}

/** Map seeded usernames to the tenant's user ids. */
async function userIds(api) {
  const users = await api.get('/api/users');
  return Object.fromEntries(users.map((u) => [u.username, u.id]));
}

/**
 * Smoothly scroll the app's page body. The layout scrolls an inner
 * `overflow-y-auto` pane under the sticky header, not the window, so
 * `window.scrollTo` (and the kit's `scrollTo` helper) do nothing there.
 */
export async function scrollPage(page, top, { settle = 900 } = {}) {
  await page.evaluate((y) => {
    // The tallest element that actually scrolls vertically is the page pane.
    const pane = [...document.querySelectorAll('div')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      })
      .sort((a, b) => b.clientHeight - a.clientHeight)[0];
    (pane ?? window).scrollTo({ top: y, behavior: 'smooth' });
  }, top);
  await page.waitForTimeout(settle);
}

/**
 * The Plan tab's List/Gantt choice is a per-user server preference, so the
 * last scene to click Gantt leaves every later recording opening on Gantt.
 * Scenes that start from the list view pin it first.
 */
export async function setTaskView(api, mode = 'list') {
  await api.patch('/api/users/me/preferences', { projectTaskViewMode: mode });
}

/**
 * Rebuild `projectId`'s schedule.
 *
 * `phases`: [{ name, status, tasks: [{ name, who, from, to, status, priority?, after? }] }]
 * `from`/`to` are day offsets from today (inclusive); `who` is a seeded
 * username; `after` lists task names this task depends on.
 *
 * Returns { project, phases: [{ id, name }], tasks: { [name]: id },
 * dates: { [name]: { start, due } } } — dates after weekend snapping.
 */
export async function stageSchedule(api, projectId, { phases, status = 'in_progress' }) {
  const project = await api.get(`/api/projects/${projectId}`);
  for (const task of project.tasks ?? []) {
    await api.del(`/api/projects/${projectId}/tasks/${task.id}`);
  }
  for (const phase of project.phases ?? []) {
    await api.del(`/api/projects/${projectId}/phases/${phase.id}`);
  }

  const ids = await userIds(api);
  const allTasks = phases.flatMap((p) => p.tasks);
  const first = Math.min(...allTasks.map((t) => t.from));
  const last = Math.max(...allTasks.map((t) => t.to));

  await api.put(`/api/projects/${projectId}`, {
    status,
    startDate: weekday(at(first)).toISOString(),
    expectedEndDate: weekday(at(last)).toISOString(),
    // The seed sets only the revised `contractValue`; anchor the original on it.
    ...(project.originalContractValue ? {} : { originalContractValue: project.contractValue }),
  });

  const created = { project, phases: [], tasks: {}, dates: {} };
  for (const [order, phase] of phases.entries()) {
    // No phase dates: POST /phases has no date coercion (JSON strings fail
    // validation), and the Gantt rolls each phase bar up from its tasks anyway.
    const row = await api.post(`/api/projects/${projectId}/phases`, {
      name: phase.name,
      order,
      status: phase.status,
    });
    created.phases.push({ id: row.id, name: row.name });

    for (const [i, task] of phase.tasks.entries()) {
      const start = weekday(at(task.from));
      const due = new Date(Math.max(weekday(at(task.to)).getTime(), start.getTime()));
      const t = await api.post(`/api/projects/${projectId}/tasks`, {
        phaseId: row.id,
        name: task.name,
        status: task.status,
        priority: task.priority ?? 'medium',
        assignedTo: ids[task.who] ?? null,
        startDate: start.toISOString(),
        dueDate: due.toISOString(),
        duration: workdays(start, due),
        order: i,
        ...(task.status === 'done' ? { completedAt: due.toISOString() } : {}),
      });
      created.tasks[task.name] = t.id;
      created.dates[task.name] = { start, due };
    }
  }

  for (const task of allTasks) {
    for (const dep of task.after ?? []) {
      await api.post(`/api/tasks/${created.tasks[task.name]}/dependencies`, {
        dependsOnTaskId: created.tasks[dep],
      });
    }
  }
  return created;
}
