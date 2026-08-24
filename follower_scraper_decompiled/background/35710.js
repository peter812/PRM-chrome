require(/*webcrack:missing*/"./14603.js");
require(/*webcrack:missing*/"./47566.js");
require(/*webcrack:missing*/"./98721.js");
require(/*webcrack:missing*/"./44114.js");
function o() {
  var e = new Date().getTime();
  var t = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (t) {
    var n = (e + Math.random() * 16) % 16 | 0;
    e = Math.floor(e / 16);
    return (t == "x" ? n : n & 3 | 8).toString(16);
  });
  return t;
}
const r = function () {
  let e = {};
  let t = {};
  let n = [];
  let r = {};
  chrome.runtime.onConnect.addListener(o => {
    n.push(o);
    let s = o.postMessage;
    o._postMessage = e => {
      s.call(o, e);
    };
    o.postMessage = (e, t) => {
      o._postMessage({
        key: e,
        message: t
      });
    };
    o.onMessage.addListener(function (n) {
      if (n.key && e[n.key]) {
        e[n.key](n.message, o, e => {
          if (n.cid) {
            o._postMessage({
              cid: n.cid,
              message: e
            });
          }
        });
      } else if (n.cid && t[n.cid]) {
        if (r.beforeResponse && r.beforeResponse(n.message, o) === false) {
          return false;
        }
        t[n.cid](n.message, o);
        delete t[n.cid];
        if (r.afterResponse) {
          r.afterResponse(n.message, o);
        }
      }
      if (r.after) {
        r.after(n.message, o);
      }
    });
  });
  return {
    add(t, n) {
      if (typeof t === "string") {
        e[t] = n;
      } else if (typeof t === "object") {
        Object.keys(t).forEach(n => {
          e[n] = t[n];
        });
      }
    },
    rm(t) {
      delete e[t];
    },
    postMessage(e, s, i) {
      if (r.before && r.before(e, s, i, port) === false) {
        return false;
      }
      let a = o();
      if (i) {
        t[a] = i;
      }
      n.forEach((t, o) => {
        try {
          if (i) {
            t._postMessage({
              key: e,
              message: s,
              cid: a
            });
          } else {
            t._postMessage({
              key: e,
              message: s
            });
          }
        } catch (r) {
          n.splice(o, 1);
        }
      });
    },
    on(e, t) {
      r[e] = t;
    },
    un(e) {
      delete r[e];
    }
  };
};
const s = function () {
  return {
    get(e, t = null) {
      return new Promise(n => {
        let o = {
          [e]: t
        };
        chrome.storage.sync.get(o, t => {
          n(t[e]);
        });
      });
    },
    set(e, t) {
      return new Promise(n => {
        let o = {
          [e]: t
        };
        chrome.storage.sync.set(o, () => {
          n(t);
        });
      });
    }
  };
};
const i = new s();
var a = i;
const c = {
  ANONYMOUS_CODE: "qimo__anonymousCode__",
  IG_USER_ID: "qimo__IG_USER_ID__",
  ACCESS_TOKEN: "qimo__accessToken__",
  USER_INFO: "qimo__userInfo__",
  CONFIG_INFO: "__CONFIG_INFO__",
  WORK_NUM: "__WORK_NUM__",
  SUGGESTIONS_NUM: "__SUGGESTIONS_NUM__",
  EXPORT_HISTORY: "____EXPORT_HISTORY____",
  SCRAPE_INTERVAL: "__SCRAPE_INTERVAL__"
};
var u = async (e = "", t = {}, n = "GET") => {
  const o = "https://service.igexporttools.com/jeecg-boot/miniapp";
  n = n.toUpperCase();
  e = o + e;
  let r = {
    credentials: "same-origin",
    method: n,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    mode: "cors",
    cache: "force-cache"
  };
  let s = await a.get(c.ACCESS_TOKEN);
  if (s) {
    r.headers.miniapp_token = s;
  }
  if (t && n !== "GET") {
    Object.defineProperty(r, "body", {
      value: JSON.stringify(t)
    });
  }
  try {
    const t = await fetch(e, r);
    const n = await t.json();
    if (n.code === 200) {
      return n.result;
    }
    throw new Error(n.message);
  } catch (i) {
    throw new Error(i);
  }
};
const f = e => u("/extensions/userInfo", e);
const _ = e => u("/user/login", e, "post");
chrome.runtime.onInstalled.addListener(async e => {
  if (e.reason === "install") {
    chrome.runtime.setUninstallURL("https://igexport.net/suggestion");
    chrome.tabs.create({
      url: "https://igexport.net"
    });
  }
});
let l = new r();
async function d(e = false) {
  let t = await a.get(c.ACCESS_TOKEN);
  let n = await a.get(c.USER_INFO);
  if (!!t && (!!e || !n)) {
    n = await f();
    await a.set(c.USER_INFO, n);
  }
  return n;
}
async function g(e) {
  let t = {
    appid: "nmaifnjhioogfcdidhimgjdhahgaibko",
    anonymousCode: "nmaifnjhioogfcdidhimgjdhahgaibko_" + e,
    identity: "igFollowers"
  };
  let n = await _(t);
  if (n) {
    await a.set(c.ACCESS_TOKEN, n.accessToken);
    let e = await d(true);
    l.postMessage("BgLogin-Respone", e);
  } else {
    l.postMessage("BgLogin-Respone", null);
  }
}
l.add("sendBg", function (e) {
  l.postMessage("cskey-bg", "我是background页面");
});
l.add("content_script", function (e) {});
l.add("BgLogin", function (e) {
  if (e) {
    g(e);
  }
});