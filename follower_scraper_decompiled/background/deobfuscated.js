(function () {
  "use strict";

  var e = {
    35710: function (e, t, n) {
      n(14603);
      n(47566);
      n(98721);
      n(44114);
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
    }
  };
  var t = {};
  function n(o) {
    var r = t[o];
    if (r !== undefined) {
      return r.exports;
    }
    var s = t[o] = {
      id: o,
      loaded: false,
      exports: {}
    };
    e[o].call(s.exports, s, s.exports, n);
    s.loaded = true;
    return s.exports;
  }
  n.m = e;
  (function () {
    var e = [];
    n.O = function (t, o, r, s) {
      if (!o) {
        var i = Infinity;
        for (f = 0; f < e.length; f++) {
          o = e[f][0];
          r = e[f][1];
          s = e[f][2];
          var a = true;
          for (var c = 0; c < o.length; c++) {
            if ((s & false || i >= s) && Object.keys(n.O).every(function (e) {
              return n.O[e](o[c]);
            })) {
              o.splice(c--, 1);
            } else {
              a = false;
              if (s < i) {
                i = s;
              }
            }
          }
          if (a) {
            e.splice(f--, 1);
            var u = r();
            if (u !== undefined) {
              t = u;
            }
          }
        }
        return t;
      }
      s = s || 0;
      for (var f = e.length; f > 0 && e[f - 1][2] > s; f--) {
        e[f] = e[f - 1];
      }
      e[f] = [o, r, s];
    };
  })();
  (function () {
    n.n = function (e) {
      var t = e && e.__esModule ? function () {
        return e.default;
      } : function () {
        return e;
      };
      n.d(t, {
        a: t
      });
      return t;
    };
  })();
  (function () {
    n.d = function (e, t) {
      for (var o in t) {
        if (n.o(t, o) && !n.o(e, o)) {
          Object.defineProperty(e, o, {
            enumerable: true,
            get: t[o]
          });
        }
      }
    };
  })();
  (function () {
    n.g = function () {
      if (typeof globalThis === "object") {
        return globalThis;
      }
      try {
        return this || new Function("return this")();
      } catch (e) {
        if (typeof window === "object") {
          return window;
        }
      }
    }();
  })();
  (function () {
    n.o = function (e, t) {
      return Object.prototype.hasOwnProperty.call(e, t);
    };
  })();
  (function () {
    n.nmd = function (e) {
      e.paths = [];
      e.children ||= [];
      return e;
    };
  })();
  (function () {
    n.j = 471;
  })();
  (function () {
    var e = {
      471: 0
    };
    n.O.j = function (t) {
      return e[t] === 0;
    };
    function t(t, o) {
      var r;
      var s;
      var i = o[0];
      var a = o[1];
      var c = o[2];
      var u = 0;
      if (i.some(function (t) {
        return e[t] !== 0;
      })) {
        for (r in a) {
          if (n.o(a, r)) {
            n.m[r] = a[r];
          }
        }
        if (c) {
          var f = c(n);
        }
      }
      for (t && t(o); u < i.length; u++) {
        s = i[u];
        if (n.o(e, s) && e[s]) {
          e[s][0]();
        }
        e[s] = 0;
      }
      return n.O(f);
    }
    var o = self.webpackChunkig_followers = self.webpackChunkig_followers || [];
    o.forEach(t.bind(null, 0));
    o.push = t.bind(null, o.push.bind(o));
  })();
  var o = n.O(undefined, [504], function () {
    return n(35710);
  });
  o = n.O(o);
})();