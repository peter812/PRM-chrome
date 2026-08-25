import { get, set, STORAGE_KEYS } from './storage.js';

const DEBUG_MODE_KEY = STORAGE_KEYS.DEBUG_MODE;

class DebugTracker {
  constructor() {
    this.enabled = false;
    this.activeTask = null;
    this.subtasks = [];
    this.originalFetch = null;
  }

  /**
   * Initialize the debug tracker.
   */
  async init() {
    this.enabled = await this.isEnabled();
    if (this.enabled) {
      this.enableFetchHook();
    }
  }

  /**
   * Check if debug mode is enabled.
   * @returns {Promise<boolean>}
   */
  async isEnabled() {
    const val = await get(DEBUG_MODE_KEY);
    return val === true;
  }

  /**
   * Set the debug mode state.
   * @param {boolean} value
   */
  async setEnabled(value) {
    this.enabled = value;
    await set(DEBUG_MODE_KEY, value);
    if (value) {
      this.enableFetchHook();
    } else {
      this.disableFetchHook();
    }
  }

  /**
   * Override global fetch to capture network request details.
   */
  enableFetchHook() {
    if (this.originalFetch) return; // already hooked
    this.originalFetch = globalThis.fetch;
    const self = this;

    globalThis.fetch = async function (resource, init = {}) {
      if (!self.enabled || !self.activeTask) {
        return self.originalFetch.apply(this, arguments);
      }

      // Resolve URL and Method
      let url = '';
      let method = 'GET';
      if (typeof resource === 'string') {
        url = resource;
      } else if (resource instanceof Request) {
        url = resource.url;
        method = resource.method || 'GET';
      } else if (resource && typeof resource === 'object' && resource.url) {
        url = resource.url;
      }

      if (init && init.method) {
        method = init.method.toUpperCase();
      }

      const currentTaskName = self.activeTask?.name;
      if (!currentTaskName) {
        return self.originalFetch.apply(this, arguments);
      }

      const headers = new Headers(
        resource instanceof Request ? resource.headers : (init && init.headers ? init.headers : {})
      );

      const serverUrl = await get(STORAGE_KEYS.SERVER_URL);
      if (serverUrl && url.startsWith(serverUrl.replace(/\/+$/, ''))) {
        const traceInfo = `task=${encodeURIComponent(currentTaskName)};subtask=Network Request: ${method} ${encodeURIComponent(url)}`;
        headers.set('X-PRM-Trace', traceInfo);
      }

      const modifiedInit = { ...init, headers };
      const subtaskName = `Network Request: ${method} ${url}`;
      const startTime = new Date();
      const startTimeStr = startTime.toISOString();

      try {
        const response = resource instanceof Request && !init.headers
          ? await self.originalFetch.call(globalThis, resource)
          : await self.originalFetch.call(globalThis, url, modifiedInit);
        const duration = new Date() - startTime;
        self.addSubtaskDirect(subtaskName, startTimeStr, `${duration}ms`);
        return response;
      } catch (err) {
        const duration = new Date() - startTime;
        self.addSubtaskDirect(`${subtaskName} (Failed: ${err.message})`, startTimeStr, `${duration}ms`);
        throw err;
      }
    };
  }

  /**
   * Restore the original fetch implementation.
   */
  disableFetchHook() {
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  /**
   * Start a new task context.
   * @param {string} name
   */
  startTask(name) {
    if (!this.enabled) return;
    this.activeTask = {
      name,
      startTime: new Date(),
    };
    this.subtasks = [];
  }

  /**
   * Start a subtask under the active task.
   * @param {string} name
   */
  startSubtask(name) {
    if (!this.enabled || !this.activeTask) return;
    const activeSubtask = {
      name,
      startTime: new Date(),
    };
    this.subtasks.push(activeSubtask);
  }

  /**
   * Complete an in-progress subtask.
   * @param {string} name
   */
  completeSubtask(name) {
    if (!this.enabled || !this.activeTask) return;
    const sub = this.subtasks.find((s) => s.name === name && s.duration === undefined);
    if (sub) {
      sub.duration = `${new Date() - sub.startTime}ms`;
    }
  }

  /**
   * Add a subtask directly with pre-calculated duration.
   * @param {string} name
   * @param {string} startTimeStr
   * @param {string} durationStr
   */
  addSubtaskDirect(name, startTimeStr, durationStr) {
    if (!this.enabled || !this.activeTask) return;
    this.subtasks.push({
      name,
      startTimeStr,
      duration: durationStr,
    });
  }

  /**
   * End the current task context and return the compiled log.
   * @returns {string|null}
   */
  completeTask() {
    if (!this.enabled || !this.activeTask) return null;
    const taskDuration = `${new Date() - this.activeTask.startTime}ms`;
    const startTimeStr = this.activeTask.startTime.toISOString();

    let log = `${this.activeTask.name} (${startTimeStr} - ${taskDuration})\n`;
    for (const sub of this.subtasks) {
      const timeStr = sub.startTimeStr || sub.startTime.toISOString();
      const durStr = sub.duration || 'in progress';
      log += `- ${sub.name} (${timeStr} - ${durStr})\n`;
    }

    this.activeTask = null;
    this.subtasks = [];
    return log;
  }
}

export const debugTracker = new DebugTracker();
