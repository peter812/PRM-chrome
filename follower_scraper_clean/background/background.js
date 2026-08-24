/**
 * Clean Background Service Worker
 * - Completely removed all connections to service.igexporttools.com and igexport.net
 * - Provides perpetual VIP license with unlimited quota
 * - Pure client-side message bus and storage management
 */

function generateUUID() {
  let d = Date.now();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Client Port Message Bus
class PortBus {
  constructor() {
    this.handlers = {};
    this.callbacks = {};
    this.connections = [];

    chrome.runtime.onConnect.addListener(port => {
      this.connections.push(port);

      port.onMessage.addListener(msg => {
        if (msg.key && this.handlers[msg.key]) {
          this.handlers[msg.key](msg.message, port, res => {
            if (msg.cid) {
              port.postMessage({ cid: msg.cid, message: res });
            }
          });
        } else if (msg.cid && this.callbacks[msg.cid]) {
          this.callbacks[msg.cid](msg.message, port);
          delete this.callbacks[msg.cid];
        }
      });

      port.onDisconnect.addListener(() => {
        const index = this.connections.indexOf(port);
        if (index !== -1) {
          this.connections.splice(index, 1);
        }
      });
    });
  }

  add(event, handler) {
    if (typeof event === "string") {
      this.handlers[event] = handler;
    } else if (typeof event === "object") {
      Object.assign(this.handlers, event);
    }
  }

  postMessage(key, message, callback) {
    const cid = generateUUID();
    if (callback) {
      this.callbacks[cid] = callback;
    }

    this.connections.forEach(port => {
      try {
        port.postMessage({ key, message, ...(callback ? { cid } : {}) });
      } catch (err) {
        // Port disconnected
      }
    });
  }
}

// Storage Helpers
const storage = {
  get(key, defaultValue = null) {
    return new Promise(resolve => {
      chrome.storage.local.get({ [key]: defaultValue }, res => {
        resolve(res[key]);
      });
    });
  },
  set(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve(value);
      });
    });
  }
};

// Storage Keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: "qimo__accessToken__",
  USER_INFO: "qimo__userInfo__",
  EXPORT_HISTORY: "____EXPORT_HISTORY____",
  SCRAPE_INTERVAL: "__SCRAPE_INTERVAL__"
};

// Unlocked VIP User Info
const UNLIMITED_VIP_USER = {
  id: "unlimited_pro_user",
  userName: "Pro User",
  vipFlag: true,
  f: true, // Free/VIP bypass flag
  anonymousFlag: false,
  expireTime: "2099-12-31 23:59:59",
  isVip: true,
  quotaRemaining: Infinity,
  unlimited: true
};

const bus = new PortBus();

// Handlers
bus.add("sendBg", (msg, port, reply) => {
  reply?.("Background active");
});

bus.add("BgLogin", async (msg, port, reply) => {
  // Always return VIP status instantly without contacting external license servers
  await storage.set(STORAGE_KEYS.USER_INFO, UNLIMITED_VIP_USER);
  await storage.set(STORAGE_KEYS.ACCESS_TOKEN, "local_unlimited_vip_token");
  bus.postMessage("BgLogin-Respone", UNLIMITED_VIP_USER);
  reply?.(UNLIMITED_VIP_USER);
});

bus.add("getUserInfo", async (msg, port, reply) => {
  reply?.(UNLIMITED_VIP_USER);
});

// Initialization
chrome.runtime.onInstalled.addListener(() => {
  console.log("Follower Scraper (Clean / Unlimited) initialized.");
  storage.set(STORAGE_KEYS.USER_INFO, UNLIMITED_VIP_USER);
});
