(function () {
  "use strict";

  var e = {
    46288: function (e, t, o) {
      var s = o(22856);
      function n() {
        var e = this;
        var t = e._self._c;
        return t("div", {
          attrs: {
            id: "app"
          }
        }, [t("router-view")], 1);
      }
      var i = [];
      var a = o(81656);
      var r = {};
      var l = (0, a.A)(r, n, i, false, null, null, null);
      var c = l.exports;
      var u = o(1594);
      function d() {
        var e = this;
        var t = e._self._c;
        return t("div", {
          staticClass: "home"
        }, [t("div", {
          staticClass: "head"
        }, [e._m(0), e.isShowSuggestions ? t("a-button", {
          staticClass: "suggestions",
          attrs: {
            type: "link",
            size: "small"
          },
          on: {
            click: e.openSuggestions
          }
        }, [e._v(" Share your suggestions ")]) : e._e(), t("div", [e.userInfo && !e.userInfo.f ? t("img", {
          staticClass: "why",
          attrs: {
            src: o(45548),
            alt: "IG Export"
          },
          on: {
            click: e.openPRO
          }
        }) : e._e(), t("img", {
          staticClass: "why",
          attrs: {
            src: o(81665),
            alt: "IG Export"
          },
          on: {
            click: e.openFaqs
          }
        })])], 1), t("a-spin", {
          attrs: {
            tip: "Loading...",
            spinning: e.spinning
          }
        }, [e.loginStatus === "nologinIg" ? t("LoginIns") : t("MainContent")], 1), t("div", {
          staticClass: "foo"
        }, [t("div", [e._v("©PERSENT "), t("a", {
          attrs: {
            href: e.homeUrl,
            target: "_blank"
          }
        }, [e._v("IGExport.net")]), e._v(" ( v1.0.20 )")]), t("a-button", {
          attrs: {
            size: "small"
          },
          on: {
            click: function (t) {
              e.contactVisible = true;
            }
          }
        }, [e._v(" Contact Us ")])], 1), t("a-modal", {
          attrs: {
            visible: e.contactVisible,
            footer: null
          },
          on: {
            cancel: function (t) {
              e.contactVisible = false;
            }
          }
        }, [t("p", [e._v(" If you have any questions, please feel free to contact us "), t("a-tag", {
          attrs: {
            color: "pink"
          }
        }, [e._v(" " + e._s(e.linkMail) + " ")]), e._v(" and tell us your ID code "), t("a-tag", {
          attrs: {
            color: "pink"
          }
        }, [e._v(" " + e._s(e.userCode) + " ")]), e._v(" . ")], 1)])], 1);
      }
      var g = [function () {
        var e = this;
        var t = e._self._c;
        return t("div", {
          staticClass: "title"
        }, [t("img", {
          attrs: {
            src: o(53111),
            alt: "IG Export"
          }
        }), e._v(" IGExport.net ")]);
      }];
      o(81630);
      var p = o(95398);
      function f() {
        var e = this;
        var t = e._self._c;
        return t("div", {
          staticClass: "login-contain flex flex-v flex-align-center flex-pack-center"
        }, [t("img", {
          attrs: {
            src: o(50869),
            alt: "stop"
          }
        }), t("a-spin", {
          attrs: {
            tip: "Loading...",
            spinning: e.spinning
          }
        }, [t("a-button", {
          staticClass: "btn",
          on: {
            click: e.sendBgLogin
          }
        }, [e._v("Login with Google")])], 1), t("div", [e._v("Please login to save your settings.")])], 1);
      }
      var h = [];
      o(14603);
      o(47566);
      o(98721);
      const m = function () {
        return {
          get(e, t = null) {
            return new Promise(o => {
              let s = {
                [e]: t
              };
              chrome.storage.sync.get(s, t => {
                o(t[e]);
              });
            });
          },
          set(e, t) {
            return new Promise(o => {
              let s = {
                [e]: t
              };
              chrome.storage.sync.set(s, () => {
                o(t);
              });
            });
          }
        };
      };
      const A = new m();
      var w = A;
      const y = {
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
      const I = 500;
      const v = 300;
      const _ = 100;
      const S = 150;
      const b = 5;
      var C = o(42332);
      var k = o.n(C);
      let x = k().create({
        baseURL: "https://service.igexporttools.com/jeecg-boot/miniapp",
        timeout: 30000
      });
      x.interceptors.request.use(async e => {
        if (e.url.indexOf("http") === -1 || E(e.baseURL) === E(e.url)) {
          let t = e.method === "formPost" ? "application/x-www-form-urlencoded" : "application/json";
          e.headers.api_version = "1.2";
          e.headers["qimo-version"] = "qq-idle2.0";
          e.headers["Content-Type"] = t;
          let o = await w.get(y.ACCESS_TOKEN);
          if (o) {
            e.headers.miniapp_token = o;
          }
        }
        return e;
      });
      x.interceptors.response.use(async e => {
        if (e.status === 200) {
          if (e.config.url.indexOf("http") !== -1 && E(e.config.baseURL) !== E(e.config.url)) {
            return e.data;
          }
          if (e.data.code === 200) {
            return e.data.result;
          }
          if (e.data.code === 401) {
            await w.set(y.ACCESS_TOKEN, "");
            alert("The session has expired. Please reopen the interface.");
          }
        }
        alert(e.data.message);
      }, e => {
        console.log("request error", e);
        throw new Error("request error");
      });
      const E = function (e) {
        let t = e.split("/");
        return t[2];
      };
      var O = x;
      const T = {
        GRAPHQL: "https://www.instagram.com/graphql/query",
        GRAPHQL_SLASH: "https://www.instagram.com/graphql/query/",
        USERS_WWW: "https://www.instagram.com/api/v1/users/",
        USERS_I: "https://i.instagram.com/api/v1/users/",
        FRIENDSHIP_WWW: "https://www.instagram.com/api/v1/friendships/show/",
        FRIENDSHIP_I: "https://i.instagram.com/api/v1/friendships/show/",
        TOPSEARCH: "https://www.instagram.com/web/search/topsearch/"
      };
      const R = {
        accept: "*/*",
        "x-asbd-id": "198387",
        "x-ig-app-id": "936619743392459"
      };
      const N = {
        PROFILE: "27937681195819736",
        SEARCH: "26347858941511777"
      };
      const U = {
        FOLLOWERS: "37479f2b8209594dde7facb0d904896a",
        FOLLOWING: "58712303d941c6855d4e888c5f0cd22f"
      };
      const P = 30000;
      function M(e) {
        if (e === null || e === undefined) {
          return "";
        } else {
          return String(e).trim().replace(/^@/, "");
        }
      }
      function F(e) {
        return e + Math.ceil(e * 0.2 * Math.random());
      }
      const L = {
        FATAL: "FATAL",
        NEEDS_VERIFY: "NEEDS_VERIFY",
        RATE_LIMITED: "RATE_LIMITED",
        RETRYABLE: "RETRYABLE"
      };
      const B = "__IG_ERROR__";
      function D({
        code: e,
        kind: t,
        message: o,
        responseInfo: s = ""
      }) {
        return new Error(JSON.stringify({
          tag: B,
          code: e,
          kind: t,
          message: o,
          responseInfo: s
        }));
      }
      function j(e) {
        if (!e || typeof e.message !== "string") {
          return false;
        }
        try {
          return JSON.parse(e.message).tag === B;
        } catch (t) {
          return false;
        }
      }
      function H(e) {
        return JSON.parse(e.message);
      }
      function G(e) {
        if (e) {
          if (typeof e.message === "string") {
            return e.message;
          } else if (e.message && typeof e.message === "object") {
            return JSON.stringify(e.message);
          } else {
            return "";
          }
        } else {
          return "";
        }
      }
      const V = ["has been deleted", "You cannot use this schema", "laser.provider", "ig_business_category"];
      function K(e) {
        const t = G(e);
        return !!t && (!!t.toLowerCase().includes("useragent mismatch") || V.some(e => t.includes(e)));
      }
      function Q(e) {
        const t = e.status;
        const o = JSON.stringify({
          status: t,
          statusText: e.statusText || "",
          url: e.url || ""
        });
        return D(t === 404 ? {
          code: t,
          kind: L.FATAL,
          responseInfo: o,
          message: "Instagram profile not found, please check your input."
        } : t === 400 || t === 401 ? {
          code: t,
          kind: L.NEEDS_VERIFY,
          responseInfo: o,
          message: "Instagram requires you to do a simple account verification. Please go to Instagram to complete it and come back."
        } : t >= 400 && t < 500 ? {
          code: t,
          kind: L.RATE_LIMITED,
          responseInfo: o,
          message: "Instagram rate limit detected. Please wait, or switch to another Instagram account."
        } : t >= 500 && t < 600 ? {
          code: t,
          kind: L.RETRYABLE,
          responseInfo: o,
          message: "Instagram server error. Please make sure instagram.com is reachable."
        } : {
          code: t,
          kind: L.RETRYABLE,
          responseInfo: o,
          message: "Failed to reach Instagram."
        });
      }
      function Y(...e) {
        for (const t of e) {
          if (typeof t === "number") {
            return t;
          }
          if (typeof t === "string" && t.trim() !== "") {
            const e = Number(t);
            if (!Number.isNaN(e)) {
              return e;
            }
          }
        }
        return "";
      }
      function q(e) {
        if (!e) {
          return null;
        }
        if (typeof e.followed_by_viewer === "boolean") {
          return e.followed_by_viewer;
        }
        const t = e.friendship_status || {};
        if (typeof t.following === "boolean") {
          return t.following;
        } else if (typeof t.is_following === "boolean") {
          return t.is_following;
        } else {
          return null;
        }
      }
      function W(e, t = "") {
        if (e) {
          return {
            ...e,
            id: e.id || e.pk || e.pk_id || t,
            profile_pic_url: e.profile_pic_url || e.profile_pic_url_hd || "",
            follower_count: Y(e.follower_count, e.edge_followed_by && e.edge_followed_by.count),
            following_count: Y(e.following_count, e.edge_follow && e.edge_follow.count)
          };
        } else {
          return null;
        }
      }
      function z(e, t = "") {
        const o = W(e, t);
        if (o && o.id) {
          return {
            status: "ok",
            data: {
              user: {
                ...o,
                id: String(o.id),
                edge_followed_by: {
                  count: Y(o.follower_count, 0)
                },
                edge_follow: {
                  count: Y(o.following_count, 0)
                },
                is_private: Boolean(e.is_private),
                followed_by_viewer: q(e)
              }
            }
          };
        } else {
          return null;
        }
      }
      function X() {
        return new Promise(e => {
          if (typeof chrome !== "undefined" && chrome.cookies && chrome.cookies.get) {
            chrome.cookies.get({
              url: "https://www.instagram.com",
              name: "csrftoken"
            }, t => e(t && t.value || ""));
          } else {
            e("");
          }
        });
      }
      async function J() {
        const e = {
          ...R,
          "x-requested-with": "XMLHttpRequest"
        };
        const t = await X();
        if (t) {
          e["x-csrftoken"] = t;
        }
        return e;
      }
      function Z(e, t, o = P) {
        let s = null;
        const n = fetch(e, t).catch(e => {
          throw D({
            code: "NETWORK_ERROR",
            kind: L.RETRYABLE,
            message: e && e.message ? e.message : "Network error"
          });
        });
        const i = new Promise((e, t) => {
          s = setTimeout(() => t(D({
            code: "TIMEOUT",
            kind: L.RETRYABLE,
            message: "Network timeout, please check your network and try again later."
          })), o);
        });
        return Promise.race([n, i]).finally(() => {
          if (s) {
            clearTimeout(s);
          }
        });
      }
      async function $(e, t, o = {}) {
        const s = await Z(e, {
          ...o,
          credentials: "include",
          headers: {
            ...t,
            ...(o.headers || {})
          }
        });
        const n = {
          status: s.status,
          statusText: s.statusText || "",
          url: s.url || e
        };
        let i = null;
        try {
          i = await s.json();
        } catch (a) {
          i = null;
        }
        return {
          resp: s,
          data: i,
          responseInfo: n
        };
      }
      async function ee(e, t, o = {}) {
        const {
          resp: s,
          data: n,
          responseInfo: i
        } = await $(e, t, o);
        if (!(s.status >= 200) || !(s.status < 400)) {
          throw Q(i);
        }
        return {
          resp: s,
          data: n
        };
      }
      const te = async e => {
        const t = await J();
        const o = `${T.GRAPHQL_SLASH}?${new URLSearchParams(e).toString()}`;
        const {
          data: s
        } = await ee(o, t);
        return s;
      };
      const oe = e => O({
        url: "/user/login",
        method: "post",
        data: e,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Expires: "0",
          "If-Modified-Since": "0"
        }
      });
      const se = e => O({
        url: `/dock/datajsonv2/${e.appid}/1.0`,
        method: "get",
        data: true
      });
      const ne = e => O({
        url: "/extensions/userInfo",
        method: "get",
        data: true
      });
      const ie = e => O({
        url: "/pripaypal/subList",
        method: "get"
      });
      const ae = e => O({
        url: "/paddle/listPaddlePlans",
        method: "get"
      });
      const re = function () {
        return {
          async login(e, t) {
            let o = await w.get(y.ANONYMOUS_CODE);
            if (!o) {
              o = this.uuid();
              await w.set(y.ANONYMOUS_CODE, o);
            }
            let s = {
              appid: "nmaifnjhioogfcdidhimgjdhahgaibko",
              anonymousCode: o,
              identity: "igFollowers"
            };
            if (e) {
              s.code = e;
            }
            if (t) {
              s.otherAttr = t;
            }
            let n = await oe(s);
            if (n) {
              await w.set(y.ACCESS_TOKEN, n.accessToken);
              return await this.getUserInfo(true);
            }
          },
          async anonLogin(e) {
            let t = {
              appid: "nmaifnjhioogfcdidhimgjdhahgaibko",
              anonymousCode: "nmaifnjhioogfcdidhimgjdhahgaibko_" + e,
              identity: "igFollowers"
            };
            let o = await oe(t);
            if (o) {
              await w.set(y.ACCESS_TOKEN, o.accessToken);
              return await this.getUserInfo(true);
            }
          },
          async getUserInfo(e = false) {
            let t = await w.get(y.ACCESS_TOKEN);
            let o = await w.get(y.USER_INFO);
            if (!!t && (!!e || !o)) {
              o = await ne();
              await w.set(y.USER_INFO, o);
            }
            return o;
          },
          uuid() {
            let e = [];
            let t = "0123456789abcdef";
            for (let o = 0; o < 36; o++) {
              e[o] = t.substr(Math.floor(Math.random() * 16), 1);
            }
            e[14] = "4";
            e[19] = t.substr(e[19] & 3 | 8, 1);
            e[8] = e[13] = e[18] = e[23] = "-";
            return e.join("");
          },
          async getConfigInfo(e = false) {
            let t = await w.get(y.CONFIG_INFO);
            if (!t || !!e) {
              t = await se({
                appid: "nmaifnjhioogfcdidhimgjdhahgaibko"
              });
              await w.set(y.CONFIG_INFO, t);
            }
            return t;
          },
          async getWorkNum() {
            let e = await w.get(y.WORK_NUM);
            return e || 0;
          },
          async workNumAddOne() {
            let e = (await w.get(y.WORK_NUM)) || 0;
            await w.set(y.WORK_NUM, e + 1);
          },
          async getSuggestionsNum() {
            return (await w.get(y.SUGGESTIONS_NUM)) || 0;
          },
          async suggestionsNumAddOne() {
            let e = await this.getSuggestionsNum();
            await w.set(y.SUGGESTIONS_NUM, e + 1);
          }
        };
      };
      const le = new re();
      var ce = le;
      o(44114);
      function ue() {
        var e = new Date().getTime();
        var t = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (t) {
          var o = (e + Math.random() * 16) % 16 | 0;
          e = Math.floor(e / 16);
          return (t == "x" ? o : o & 3 | 8).toString(16);
        });
        return t;
      }
      const de = function () {
        let e = {};
        let t = {};
        let o = {};
        let s = chrome.runtime.connect({
          name: ue()
        });
        let n = s.postMessage;
        s._postMessage = e => {
          n.call(s, e);
        };
        s.postMessage = (e, t) => {
          s._postMessage({
            key: e,
            message: t
          });
        };
        s.onMessage.addListener(function (n) {
          if (n.key && e[n.key]) {
            e[n.key](n.message, s, e => {
              if (n.cid) {
                s._postMessage({
                  cid: n.cid,
                  message: e
                });
              }
            });
          } else if (n.cid && t[n.cid]) {
            if (o.beforeResponse && o.beforeResponse(n.message, s) === false) {
              return false;
            }
            t[n.cid](n.message, s);
            delete t[n.cid];
            if (o.afterResponse) {
              o.afterResponse(n.message, s);
            }
          }
          if (o.after) {
            o.after(n.message, s);
          }
        });
        return {
          add(t, o) {
            if (typeof t === "string") {
              e[t] = o;
            } else if (typeof t === "object") {
              Object.keys(t).forEach(o => {
                e[o] = t[o];
              });
            }
          },
          rm(t) {
            delete e[t];
          },
          postMessage(e, n, i) {
            if (o.before && o.before(e, n, i, s) === false) {
              return false;
            }
            if (i) {
              let o = ue();
              t[o] = i;
              s._postMessage({
                key: e,
                message: n,
                cid: o
              });
            } else {
              s._postMessage({
                key: e,
                message: n
              });
            }
          },
          on(e, t) {
            o[e] = t;
          },
          un(e) {
            delete o[e];
          }
        };
      };
      var ge = {
        name: "Login",
        data() {
          return {
            spinning: false,
            bg: null
          };
        },
        mounted() {
          this.bg = new de();
          this.bg.add("BgLogin-Respone", async e => {
            this.spinning = false;
            if (e) {
              this.$emit("isLogin");
            } else {
              this.$message.warning("Google authorization failed.");
            }
          });
          this.forAuthToken();
        },
        methods: {
          sendBgLogin() {
            this.spinning = true;
            this.bg.postMessage("BgLogin", true);
          },
          async oauth() {
            this.spinning = true;
            let e = "nmaifnjhioogfcdidhimgjdhahgaibko";
            let t = chrome.identity.getRedirectURL();
            let o = Math.random().toString(36).substring(2, 15);
            const s = new URL("https://accounts.google.com/o/oauth2/auth");
            s.searchParams.set("client_id", e);
            s.searchParams.set("response_type", "id_token");
            s.searchParams.set("redirect_uri", t);
            s.searchParams.set("scope", "openid profile email");
            s.searchParams.set("nonce", o);
            s.searchParams.set("prompt", "consent");
            chrome.identity.launchWebAuthFlow({
              url: s.href,
              interactive: true
            }, async e => {
              if (e) {
                {
                  const t = e.split("#")[1];
                  const o = new URLSearchParams(t);
                  const s = o.get("id_token");
                  let n = await ce.login(s);
                  if (n) {
                    this.$emit("isLogin");
                  }
                }
                this.spinning = false;
              } else {
                this.$message.warning("Google authorization failed.");
              }
            });
          },
          forAuthToken() {
            this.spinning = true;
            let e = this;
            chrome.identity.getAuthToken({
              interactive: true
            }, function (t) {
              if (chrome.runtime.lastError) {
                callback(chrome.runtime.lastError);
              } else {
                var o = new XMLHttpRequest();
                o.open("GET", "https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=" + t);
                o.setRequestHeader("Authorization", "Bearer " + t);
                o.onload = async function () {
                  if (this.status === 401) {
                    chrome.identity.removeCachedAuthToken({
                      token: t
                    }, null);
                    e.spinning = false;
                    return;
                  }
                  let o = await ce.login(null, this.responseText);
                  if (o) {
                    e.spinning = false;
                    e.$emit("isLogin");
                  }
                };
                o.send();
              }
            });
          },
          getAuthToken() {
            chrome.identity.getAuthToken({
              interactive: true
            }, function (e) {});
          },
          authenticatedXhr(e, t, o) {}
        }
      };
      var pe = ge;
      var fe = (0, a.A)(pe, f, h, false, null, "2f764af6", null);
      var he = fe.exports;
      function me() {
        var e = this;
        var t = e._self._c;
        return t("div", {
          staticClass: "contain flex-v flex-align-center flex-pack-center"
        }, [t("div", [e._v("Please log in to Instagram first and try again.")]), t("div", {
          staticClass: "link"
        }, [t("img", {
          staticClass: "animate__animated animate__shakeX animate__infinite animate__slower",
          attrs: {
            src: o(21614),
            alt: "right"
          }
        }), t("a", {
          attrs: {
            href: "#"
          },
          on: {
            click: e.gotoInstagram
          }
        }, [e._v("www.instagram.com")])])]);
      }
      var Ae = [];
      var we = {
        name: "LoginIns",
        methods: {
          gotoInstagram() {
            window.open("https://www.instagram.com");
          }
        }
      };
      var ye = we;
      var Ie = (0, a.A)(ye, me, Ae, false, null, "b950c378", null);
      var ve = Ie.exports;
      function _e() {
        var e = this;
        var t = e._self._c;
        return t("div", {
          staticStyle: {
            width: "100%"
          },
          style: e.isAnon ? "" : "padding-top: 12px;"
        }, [e.isAnon ? t("a-alert", {
          staticStyle: {
            "margin-bottom": "4px"
          },
          attrs: {
            banner: ""
          }
        }, [t("div", {
          attrs: {
            slot: "message"
          },
          slot: "message"
        }, [e._v(" Sign in to prevent data loss. "), t("a-button", {
          staticStyle: {
            "margin-left": "10px"
          },
          attrs: {
            type: "primary",
            size: "small"
          },
          on: {
            click: function (t) {
              return e.openAuthUrl();
            }
          }
        }, [e._v(" Sign in ")])], 1)]) : e._e(), t("div", {
          staticClass: "content-contain"
        }, [t("div", {
          staticClass: "content flex-v flex-pack-center"
        }, [t("div", [t("div", {
          staticClass: "loginTure flex-v flex-align-center flex-pack-center"
        }, [t("div", {
          staticClass: "task-input-area"
        }, [t("div", {
          staticClass: "label-title"
        }, [e._v(" Enter Instagram Username ")]), t("a-input", {
          staticClass: "input",
          attrs: {
            "allow-clear": "",
            prefix: "@",
            placeholder: "e.g. amazon"
          },
          model: {
            value: e.userName,
            callback: function (t) {
              e.userName = t;
            },
            expression: "userName"
          }
        }), e.useUrl ? t("a-button", {
          staticClass: "how-to-use",
          attrs: {
            type: "link",
            icon: "bulb",
            size: "small"
          },
          on: {
            click: e.openUseUrl
          }
        }, [e._v(" How to use? ")]) : e._e(), t("div", {
          staticClass: "btn-s flex flex-pack-between"
        }, [t("a-button", {
          staticClass: "btn",
          attrs: {
            type: "primary"
          },
          on: {
            click: function (t) {
              return e.openExportView("Followers");
            }
          }
        }, [e._v("Export Followers")]), t("a-button", {
          staticClass: "btn",
          on: {
            click: function (t) {
              return e.openExportView("Following");
            }
          }
        }, [e._v("Export Following")])], 1)], 1), e.historyList.length > 0 ? t("div", {
          staticClass: "history-section"
        }, [t("div", {
          staticClass: "history-header"
        }, [t("span", {
          staticClass: "history-title"
        }, [e._v("Recent tasks")]), t("a-button", {
          staticClass: "history-clear",
          attrs: {
            type: "link",
            size: "small"
          },
          on: {
            click: e.clearAllHistory
          }
        }, [t("a-icon", {
          attrs: {
            type: "delete"
          }
        }), e._v(" Clear all ")], 1)], 1), t("div", {
          staticClass: "history-list"
        }, e._l(e.historyList, function (o) {
          return t("div", {
            key: o.hid,
            staticClass: "history-item"
          }, [t("a-tooltip", {
            attrs: {
              title: o.matchParam.type === "Followers" ? "Followers task" : "Following task"
            }
          }, [t("a-icon", {
            staticClass: "task-icon",
            attrs: {
              type: o.matchParam.type === "Followers" ? "team" : "usergroup-add"
            }
          })], 1), t("div", {
            staticClass: "task-name-cell"
          }, [t("a-tooltip", {
            attrs: {
              title: `@${o.matchParam.userName}`,
              placement: "top"
            }
          }, [t("span", {
            staticClass: "task-name-text"
          }, [e._v(e._s(o.matchParam.userName))])])], 1), t("a-tooltip", {
            attrs: {
              title: o.dataSource && o.dataSource.length > 0 ? `Click to download ${o.dataSource.length} users as CSV` : `${o.dataSource ? o.dataSource.length : 0} extracted of ${o.totalCount} total`
            }
          }, [t("span", {
            class: ["task-stats", o.dataSource && o.dataSource.length > 0 ? "task-stats-clickable" : ""],
            on: {
              click: function (t) {
                return e.downloadTask(o);
              }
            }
          }, [o.dataSource && o.dataSource.length > 0 ? t("a-icon", {
            staticClass: "task-stats-icon",
            attrs: {
              type: "download"
            }
          }) : e._e(), e._v(" " + e._s(o.dataSource ? o.dataSource.length : 0) + "/" + e._s(o.totalCount) + " ")], 1)]), o.completeFlag ? t("a-tooltip", {
            attrs: {
              title: "Task completed"
            }
          }, [t("a-icon", {
            staticClass: "task-complete",
            attrs: {
              type: "check-circle"
            }
          })], 1) : t("a-tooltip", {
            attrs: {
              title: "Continue extracting"
            }
          }, [t("a-button", {
            staticClass: "task-action",
            attrs: {
              type: "link",
              size: "small"
            },
            on: {
              click: function (t) {
                return e.continueTask(o);
              }
            }
          }, [t("a-icon", {
            attrs: {
              type: "play-circle"
            }
          })], 1)], 1), t("a-tooltip", {
            attrs: {
              title: "Delete this record"
            }
          }, [t("a-button", {
            staticClass: "task-action task-delete",
            attrs: {
              type: "link",
              size: "small"
            },
            on: {
              click: function (t) {
                return e.deleteTask(o);
              }
            }
          }, [t("a-icon", {
            attrs: {
              type: "delete"
            }
          })], 1)], 1)], 1);
        }), 0)]) : e._e(), e.moreObj.moreUrl || e.moreObj.moreList && e.moreObj.moreList.length > 0 ? t("div", {
          staticClass: "more-tools"
        }, [t("div", {
          staticClass: "more-tools-title-group"
        }, [t("span", {
          staticClass: "more-tools-title-text"
        }, [e._v("More Instagram Tools")]), e.moreObj.moreUrl ? t("span", {
          staticClass: "more-tools-jump-text",
          on: {
            click: e.openMoreUrl
          }
        }, [e._v("View more >>")]) : e._e()]), e.moreObj.moreList && e.moreObj.moreList.length > 0 ? t("div", {
          staticClass: "more-tools-scroll"
        }, e._l(e.moreObj.moreList, function (o, s) {
          return t("a", {
            key: s,
            staticClass: "flex more-tools-item",
            style: "color:" + o.listForegroundColor,
            on: {
              click: function (t) {
                return e.jumpTo(o.jumpTo);
              }
            }
          }, [t("img", {
            attrs: {
              src: o.listIcon,
              alt: o.listName
            }
          }), t("div", {
            staticClass: "flex1"
          }, [t("div", {
            staticClass: "tool-name"
          }, [e._v(e._s(o.listName))]), t("div", {
            staticClass: "tool-desc"
          }, [e._v(e._s(o.listDesc))])])]);
        }), 0) : e._e()]) : e._e()])])])])], 1);
      }
      var Se = [];
      const be = y.EXPORT_HISTORY;
      const Ce = (e, t = null) => new Promise(o => {
        chrome.storage.local.get({
          [e]: t
        }, t => o(t[e]));
      });
      const ke = (e, t) => new Promise(o => {
        chrome.storage.local.set({
          [e]: t
        }, () => o(t));
      });
      const xe = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const Ee = async () => {
        const e = (await Ce(be)) || [];
        return e.sort((e, t) => t.timestamp - e.timestamp);
      };
      const Oe = async e => {
        const t = (await Ce(be)) || [];
        return t.find(t => t.hid === e) || null;
      };
      const Te = async e => {
        const t = (await Ce(be)) || [];
        const o = t.findIndex(t => t.hid === e.hid);
        const s = Date.now();
        if (o >= 0) {
          t[o] = {
            ...e,
            createdAt: t[o].createdAt || e.createdAt || s,
            timestamp: s
          };
        } else {
          t.push({
            ...e,
            createdAt: e.createdAt || s,
            timestamp: s
          });
        }
        await ke(be, t);
      };
      const Re = async e => {
        const t = (await Ce(be)) || [];
        const o = t.filter(t => t.hid !== e);
        await ke(be, o);
      };
      const Ne = async () => {
        await ke(be, []);
      };
      const Ue = e => {
        const t = [["Avatar", "Username", "Full Name", "User ID", "Followed By You"]];
        e.forEach(e => {
          e.avatar &&= e.avatar.replace("https://cdn.getwebooster.workers.dev/", "");
          const o = Object.keys(e);
          const s = o.map(t => e[t]);
          t.push(s);
        });
        return t;
      };
      const Pe = (e, t = {}) => {
        const o = t.columnDelimiter || ",";
        const s = t.lineDelimiter || "\n";
        const n = Ue(e);
        return n.reduce((e, t) => {
          let n;
          n = Array.isArray(t) ? t.reduce((e, t) => {
            let n = e ? e + o : e;
            if (t) {
              const e = t.toString().replace(new RegExp(s, "g"), " ");
              n += /,/.test(e) ? `"${e}"` : e;
            }
            return n;
          }, "") : t;
          return (e ? e + s : "") + n;
        }, "");
      };
      const Me = (e, t = "export.csv") => {
        const o = "﻿";
        if (navigator.msSaveOrOpenBlob) {
          const s = new Blob([o + e], {
            type: "text/csv;charset=utf-8;"
          });
          navigator.msSaveOrOpenBlob(s, t);
        } else {
          const s = encodeURI(`data:text/csv;charset=utf-8,${o}${e}`);
          const n = document.createElement("a");
          n.href = s;
          n.download = t;
          document.body.appendChild(n);
          n.click();
          document.body.removeChild(n);
        }
      };
      const Fe = (e, t, o = "Followers") => {
        if (!e || e.length === 0) {
          return;
        }
        const s = JSON.parse(JSON.stringify(e));
        const n = Pe(s);
        const i = (t || "export").replace(/[^a-zA-Z0-9_-]/g, "_");
        const a = `IGExport_${o}_${i}_${new Date().getTime()}.csv`;
        Me(n, a);
      };
      var Le = {
        name: "MainContent",
        data() {
          return {
            tabVal: "core",
            isVip: false,
            isFree: false,
            userName: "",
            dingYueList: [],
            spinning: false,
            userInfo: {},
            configInfo: null,
            historyList: []
          };
        },
        async mounted() {
          await ce.getWorkNum();
          await this.getValueFromStore();
          await this.loadHistory();
          window.addEventListener("focus", this.loadHistory);
        },
        beforeDestroy() {
          window.removeEventListener("focus", this.loadHistory);
        },
        computed: {
          moreObj() {
            return this.configInfo && this.configInfo.moreObj || {
              moreUrl: "",
              moreList: []
            };
          },
          useUrl() {
            return this.configInfo && this.configInfo.useUrl || "";
          },
          isAnon() {
            return !!this.userInfo && !!this.userInfo.anonymousFlag;
          },
          authParkUrl() {
            return this.configInfo && this.configInfo.aUrl || "";
          }
        },
        watch: {
          tabVal: {
            immediate: true,
            handler(e, t) {
              if (e === "vip" && this.dingYueList.length === 0) {
                this.listPaddlePlans();
              }
            }
          }
        },
        methods: {
          changeTab(e) {
            this.tabVal = e;
          },
          async openExportView(e) {
            const t = M(this.userName);
            if (!t) {
              this.$message.warning("Please Enter UserName.");
              return;
            }
            this.userName = t;
            if (this.userInfo && this.userInfo.f && this.configInfo && this.configInfo.cdcn && this.configInfo.cdcn > 0) {
              const e = await ce.getWorkNum();
              if (e >= 2) {
                const e = await ce.getSuggestionsNum();
                if (e < this.configInfo.cdcn) {
                  const e = await this.openSuggestions();
                  if (e === "ok") {
                    return;
                  }
                }
              }
            }
            await ce.workNumAddOne();
            await this.$cStorage.set("userName", t);
            let o = "chrome-extension://" + this.getExtensionId() + "/popup.html#/export?type=" + encodeURIComponent(e) + "&userName=" + encodeURIComponent(t);
            window.open(o);
          },
          getExtensionId() {
            return chrome.runtime.id;
          },
          async getValueFromStore() {
            this.userName = await this.$cStorage.get("userName", "");
            this.userInfo = await ce.getUserInfo(false);
            if (this.userInfo) {
              this.isFree = this.userInfo.f;
              this.isVip = this.userInfo.f || this.userInfo.vipFlag;
            }
            this.configInfo ||= await ce.getConfigInfo(false);
          },
          async getSubList() {
            this.spinning = true;
            this.dingYueList = await ie();
            this.spinning = false;
          },
          async listPaddlePlans() {
            this.spinning = true;
            this.dingYueList = await ae();
            this.spinning = false;
          },
          async gotoPay(e) {
            window.open(`${e.payUrl}?version=${e.version}&location_href=${e.locationHref}&plan_id=${e.subscriptionPlanId}&miniapp_config_id=${e.miniappConfigId}&user_id=${this.userInfo.id}`);
          },
          openMoreUrl() {
            window.open(this.moreObj.moreUrl, "_blank");
          },
          openUseUrl() {
            window.open(this.useUrl, "_blank");
          },
          jumpTo(e) {
            window.open(e, "_blank");
          },
          openSuggestions() {
            return new Promise((e, t) => {
              p.A.confirm({
                content: "Your positive review means the world to us! If you could take a moment to leave a 5-star review, it would be greatly appreciated. Thank you for your support!",
                centered: true,
                cancelText: "Not now",
                okText: "Write a review",
                async onOk() {
                  await ce.suggestionsNumAddOne();
                  window.open(`https://chrome.google.com/webstore/detail/${chrome.runtime.id}/reviews`, "_blank");
                  e("ok");
                },
                onCancel() {
                  e("cancel");
                }
              });
            });
          },
          async openAuthUrl() {
            let e = await this.getIgUserId();
            if (!e) {
              console.error("no igUserId", e);
              return;
            }
            const t = this.authParkUrl + "&state=" + encodeURI(JSON.stringify({
              appid: "nmaifnjhioogfcdidhimgjdhahgaibko",
              anonymousCode: "nmaifnjhioogfcdidhimgjdhahgaibko_" + e,
              identity: "igFollowers"
            }));
            console.log("authUrl", t);
            window.open(t, "_blank");
          },
          async getIgUserId() {
            let e = await w.get(y.IG_USER_ID);
            if (e) {
              return e;
            }
            const t = await this.getIGCookie();
            if (t) {
              e = t;
              await w.set(y.IG_USER_ID, e);
            }
            return e;
          },
          getIGCookie() {
            return new Promise(e => {
              chrome.cookies.get({
                url: "https://www.instagram.com",
                name: "ds_user_id"
              }, t => {
                e(t ? t.value : null);
              });
            });
          },
          async loadHistory() {
            this.historyList = await Ee();
          },
          downloadTask(e) {
            if (e.dataSource && e.dataSource.length !== 0) {
              Fe(e.dataSource, e.matchParam.userName, e.matchParam.type);
            }
          },
          continueTask(e) {
            if (!this.isVip && (e.dataSource.length || 0) >= I) {
              const e = this;
              p.A.confirm({
                title: "Upgrade to Pro",
                content: "Free users can extract up to 500 followers/following per task. Upgrade to Pro to continue beyond this limit.",
                centered: true,
                okText: "Upgrade",
                cancelText: "Maybe later",
                async onOk() {
                  if (e.configInfo && e.configInfo.payUrl) {
                    chrome.windows.create({
                      url: e.configInfo.payUrl + "?uid=" + e.userInfo.id,
                      type: "popup",
                      state: "fullscreen"
                    });
                  }
                }
              });
              return;
            }
            const t = "chrome-extension://" + chrome.runtime.id + "/popup.html#/export?type=" + encodeURIComponent(e.matchParam.type) + "&userName=" + encodeURIComponent(e.matchParam.userName) + "&hid=" + encodeURIComponent(e.hid);
            window.open(t);
          },
          deleteTask(e) {
            const t = this;
            p.A.confirm({
              title: "Delete this history record?",
              content: `Task: @${e.matchParam.userName} (${e.dataSource.length} extracted). This cannot be undone.`,
              okText: "Delete",
              okType: "danger",
              cancelText: "Cancel",
              centered: true,
              async onOk() {
                await Re(e.hid);
                await t.loadHistory();
              }
            });
          },
          clearAllHistory() {
            if (this.historyList.length === 0) {
              return;
            }
            const e = this;
            p.A.confirm({
              title: "Clear all history?",
              content: `All ${this.historyList.length} records will be permanently removed. This cannot be undone.`,
              okText: "Clear all",
              okType: "danger",
              cancelText: "Cancel",
              centered: true,
              async onOk() {
                await Ne();
                await e.loadHistory();
              }
            });
          }
        }
      };
      var Be = Le;
      var De = (0, a.A)(Be, _e, Se, false, null, "4b2ac8fb", null);
      var je = De.exports;
      var He = {
        name: "HomeView",
        components: {
          Login: he,
          LoginIns: ve,
          MainContent: je
        },
        data() {
          return {
            loginStatus: "nologinIg",
            currentUserId: "",
            bg: null,
            spinning: false,
            contactVisible: false,
            configInfo: null,
            userInfo: null,
            isShowSuggestions: false
          };
        },
        computed: {
          linkMail() {
            if (this.configInfo) {
              return this.configInfo.linkMail || "";
            } else {
              return "hello@igexport.net";
            }
          },
          userCode() {
            if (this.userInfo) {
              return this.userInfo.shareCode || "";
            } else {
              return "null";
            }
          },
          homeUrl() {
            return this.configInfo && this.configInfo.homeUrl || "https://igexport.net";
          },
          faqsUrl() {
            return this.configInfo && this.configInfo.faqsUrl || "https://igexport.net/#FAQ";
          }
        },
        async created() {
          this.spinning = true;
          this.configInfo ||= await ce.getConfigInfo(true);
          this.isLogin();
        },
        methods: {
          async isLogin2() {
            let e = await w.get(y.ACCESS_TOKEN);
            if (e) {
              this.loginStatus = "nologinIg";
              chrome.cookies.get({
                url: "https://www.instagram.com",
                name: "ds_user_id"
              }, e => {
                if (e) {
                  this.currentUserId = e.value;
                  this.loginStatus = "logined";
                }
              });
            } else {
              this.loginStatus = "noLogin";
            }
          },
          async isLogin() {
            const e = await this.getIGCookie();
            let t = e || (await w.get(y.IG_USER_ID));
            if (e) {
              await w.set(y.IG_USER_ID, e);
            }
            this.userInfo = await ce.anonLogin(t);
            await this.optShowSuggestions();
            if (e) {
              this.loginStatus = "logined";
            }
            this.spinning = false;
          },
          getIGCookie() {
            return new Promise(e => {
              chrome.cookies.get({
                url: "https://www.instagram.com",
                name: "ds_user_id"
              }, t => {
                e(t ? t.value : null);
              });
            });
          },
          getAllCookie() {
            chrome.cookies.getAll({}, function (e) {});
          },
          openFaqs() {
            window.open(this.faqsUrl, "_blank");
          },
          async openPRO() {
            if (this.configInfo && this.configInfo.payUrl) {
              chrome.windows.create({
                url: this.configInfo.payUrl + "?uid=" + this.userInfo.id,
                type: "popup",
                state: "fullscreen"
              });
            }
          },
          async optShowSuggestions() {
            if (this.userInfo && this.userInfo.f && this.configInfo && this.configInfo.cscn && this.configInfo.cscn > 0) {
              const e = await ce.getSuggestionsNum();
              if (e < this.configInfo.cscn) {
                this.isShowSuggestions = true;
                return;
              }
            }
            this.isShowSuggestions = false;
          },
          async openSuggestions() {
            const e = this;
            p.A.confirm({
              content: "Your positive review means the world to us! If you could take a moment to leave a 5-star review, it would be greatly appreciated. Thank you for your support!",
              centered: true,
              cancelText: "Not now",
              okText: "Write a review",
              async onOk() {
                await ce.suggestionsNumAddOne();
                await e.optShowSuggestions();
                window.open(`https://chrome.google.com/webstore/detail/${chrome.runtime.id}/reviews`, "_blank");
              },
              onCancel() {}
            });
          }
        }
      };
      var Ge = He;
      var Ve = (0, a.A)(Ge, d, g, false, null, "e2a6c510", null);
      var Ke = Ve.exports;
      function Qe() {
        var e = this;
        var t = e._self._c;
        return t("div", {
          staticClass: "export-home"
        }, [t("div", {
          staticClass: "contain"
        }, [t("div", {
          staticClass: "head flex flex-align-center flex-pack-between"
        }, [t("b", [e._v("Instagram Export")]), t("span", {
          staticClass: "ig-menu flex flex-align-center"
        }, [!e.isFree && e.configInfo && e.configInfo.payUrl ? t("div", {
          staticClass: "ig-menu-item",
          on: {
            click: e.openPRO
          }
        }, [t("img", {
          attrs: {
            src: o(88920),
            alt: "Instagram Export"
          }
        }), t("div", [e._v(" PRO ")])]) : e._e(), e.moreObj.moreUrl ? t("div", {
          staticClass: "ig-menu-item",
          on: {
            click: e.openMoreUrl
          }
        }, [t("img", {
          attrs: {
            src: o(91449),
            alt: "Instagram Export"
          }
        }), t("div", [e._v(" More Instagram Tools ")])]) : e._e(), t("div", {
          staticClass: "ig-menu-item",
          on: {
            click: function (t) {
              e.contactVisible = true;
            }
          }
        }, [t("img", {
          attrs: {
            src: o(77764),
            alt: "Instagram Export"
          }
        }), t("div", [e._v(" Contact Us ")])]), e.faqsUrl ? t("div", {
          staticClass: "ig-menu-item",
          on: {
            click: e.openFaqs
          }
        }, [t("img", {
          attrs: {
            src: o(44471),
            alt: "Instagram Export"
          }
        }), t("div", [e._v(" FAQs ")])]) : e._e()])]), t("a-spin", {
          attrs: {
            tip: "Loading...",
            spinning: e.spinning
          }
        }, [t("div", {
          staticClass: "body"
        }, [t("div", {
          staticClass: "user-info"
        }, [t("h2", [e._v("@" + e._s(e.userInfo.userName) + " " + e._s(e.userInfo.followers) + " followers " + e._s(e.userInfo.following) + " following")]), e.vipFlag ? e._e() : t("span", {
          staticStyle: {
            color: "red",
            "margin-top": "28px",
            "font-weight": "700",
            display: "block",
            "font-size": "17px"
          }
        }, [t("div", [e._v(" The maximum number of exported users for a free account is 500, but it can be upgraded to the Pro version, which allows for unlimited exports. ")]), t("a-button", {
          attrs: {
            type: "primary"
          },
          on: {
            click: e.openPRO
          }
        }, [e._v(" UPGRADE TO PRO NOW >>> ")])], 1)]), t("div", {
          staticClass: "process flex flex-pack-between flex-align-center"
        }, [t("a-progress", {
          staticClass: "circle",
          attrs: {
            type: "circle",
            percent: e.loopInfo.percent
          },
          scopedSlots: e._u([{
            key: "format",
            fn: function (o) {
              return [t("span", {
                staticStyle: {
                  color: "#778bed"
                }
              }, [e._v(e._s(e.dataSource.length))]), e._v("/"), t("span", {
                staticStyle: {
                  color: "#778bed"
                }
              }, [e._v(e._s(e.loopInfo.limitUpper))])];
            }
          }])
        }), e.processStatus === "loading" ? t("div", {
          staticClass: "desc flex flex-align-center"
        }, [t("span", {
          staticClass: "loader"
        }), e._v(" Exporting " + e._s(e.userInfo.exportType) + "... ")]) : e._e(), e.processStatus === "stopping" ? t("div", {
          staticClass: "desc"
        }, [e._v("Paused...")]) : e._e(), e.processStatus === "suspended" ? t("div", {
          staticClass: "desc"
        }, [e._v("Paused — see the message below")]) : e._e(), e.processStatus === "cooling" ? t("div", {
          staticClass: "desc"
        }, [e._v("Cooling down… " + e._s(e.coolingSec) + "s")]) : e._e(), e.processStatus === "nothing" ? t("div", {
          staticClass: "desc"
        }, [e._v(e._s(e.userInfo.userName) + " has no data, please input other name... ")]) : e._e(), e.processStatus === "finished" ? t("div", {
          staticClass: "desc"
        }, [e._v("Finished...")]) : e._e(), e.processStatus === "loading" || e.processStatus === "cooling" ? t("a-button", {
          staticClass: "sto-star flex flex-pack-between flex-align-center",
          on: {
            click: e.stop
          }
        }, [t("img", {
          attrs: {
            src: o(18906),
            alt: "stop"
          }
        }), e._v(" STOP ")]) : e._e(), e.processStatus === "stopping" || e.processStatus === "suspended" ? t("a-button", {
          staticClass: "sto-star flex flex-pack-between flex-align-center",
          staticStyle: {
            "background-color": "#647beb"
          },
          on: {
            click: e.start
          }
        }, [t("img", {
          attrs: {
            src: o(34170),
            alt: "START"
          }
        }), e._v(" " + e._s(e.processStatus === "suspended" ? "CONTINUE" : "START") + " ")]) : e._e(), t("a-button", {
          staticClass: "down flex flex-pack-between flex-align-center",
          style: e.dataSource.length <= 0 ? "background-color: darkgrey" : "",
          attrs: {
            disabled: e.dataSource.length <= 0
          },
          on: {
            click: e.cliDownLoad
          }
        }, [t("img", {
          attrs: {
            src: o(73119),
            alt: "stop"
          }
        }), e._v(" Download " + e._s(e.dataSource.length) + " " + e._s(e.userInfo.exportType) + " ")])], 1), t("div", {
          staticClass: "interval-setting flex flex-align-center"
        }, [t("span", {
          staticClass: "interval-label"
        }, [e._v("Delay between requests")]), t("a-slider", {
          staticClass: "interval-slider",
          attrs: {
            min: 1,
            max: 30,
            step: 1
          },
          model: {
            value: e.intervalSec,
            callback: function (t) {
              e.intervalSec = t;
            },
            expression: "intervalSec"
          }
        }), t("a-input-number", {
          attrs: {
            min: 1,
            max: 30,
            step: 1,
            size: "small"
          },
          on: {
            blur: e.normalizeIntervalInput
          },
          model: {
            value: e.intervalSec,
            callback: function (t) {
              e.intervalSec = t;
            },
            expression: "intervalSec"
          }
        }), t("span", {
          staticClass: "interval-unit"
        }, [e._v("sec")]), e.intervalSec < 5 ? t("span", {
          staticClass: "interval-warn"
        }, [e._v(" Below 5s significantly raises the risk of hitting Instagram's rate limit. ")]) : e._e()], 1), e.statusTip ? t("a-alert", {
          staticStyle: {
            "margin-bottom": "20px"
          },
          attrs: {
            type: "warning",
            "show-icon": "",
            message: e.statusTip
          }
        }) : e._e(), e.moreObj.moreUrl || e.moreObj.moreList && e.moreObj.moreList.length > 0 ? t("div", {
          staticClass: "export-more-tools"
        }, [t("div", {
          staticClass: "export-more-tools-title-group"
        }, [t("span", {
          staticClass: "export-more-tools-title-text"
        }, [e._v("More Instagram Tools")]), e.moreObj.moreUrl ? t("span", {
          staticClass: "export-more-tools-jump-text",
          on: {
            click: e.openMoreUrl
          }
        }, [e._v("View more >>")]) : e._e()]), e.moreObj.moreList && e.moreObj.moreList.length > 0 ? t("div", {
          staticClass: "export-more-tools-scroll"
        }, e._l(e.moreObj.moreList, function (o, s) {
          return t("div", {
            key: s,
            staticClass: "export-more-tools-item-parent"
          }, [t("a", {
            staticClass: "flex export-more-tools-item",
            style: "color:" + o.listForegroundColor,
            on: {
              click: function (t) {
                return e.jumpTo(o.jumpTo);
              }
            }
          }, [t("img", {
            attrs: {
              src: o.listIcon,
              alt: o.listName
            }
          }), t("div", {
            staticClass: "flex1"
          }, [t("div", {
            staticClass: "tool-name"
          }, [e._v(e._s(o.listName))]), t("div", {
            staticClass: "tool-desc more-ellipsis"
          }, [e._v(e._s(o.listDesc))])])])]);
        }), 0) : e._e()]) : e._e(), t("div", {
          staticClass: "table"
        }, [t("a-table", {
          attrs: {
            columns: e.columns,
            "data-source": e.dataSource
          },
          scopedSlots: e._u([{
            key: "avatar",
            fn: function (e) {
              return t("a-avatar", {
                attrs: {
                  size: 64,
                  src: e
                }
              });
            }
          }, {
            key: "followed",
            fn: function (o) {
              return t("a-tag", {
                attrs: {
                  color: o === "Yes" ? "#ff5500" : "#cfcfd0"
                }
              }, [e._v(" " + e._s(o) + " ")]);
            }
          }])
        })], 1)], 1)])], 1), t("a-modal", {
          attrs: {
            visible: e.contactVisible,
            footer: null
          },
          on: {
            cancel: function (t) {
              e.contactVisible = false;
            }
          }
        }, [t("p", [e._v(" If you have any questions, please feel free to contact us "), t("a-tag", {
          attrs: {
            color: "pink"
          }
        }, [e._v(" " + e._s(e.linkMail) + " ")]), e._v(" and tell us your ID code "), t("a-tag", {
          attrs: {
            color: "pink"
          }
        }, [e._v(" " + e._s(e.userCode) + " ")]), e._v(" . ")], 1)])], 1);
      }
      var Ye = [];
      function qe(e) {
        const t = encodeURIComponent(e);
        return [`${T.USERS_WWW}${t}/info/`, `${T.USERS_I}${t}/info/`];
      }
      function We(e) {
        return D({
          code: "IG_REJECTED",
          kind: L.FATAL,
          message: "Instagram rejected this profile due to an API schema error. Please try another username.",
          responseInfo: JSON.stringify(e || {})
        });
      }
      async function ze(e) {
        const t = await J();
        const o = e.toLowerCase();
        let s = 0;
        const n = e => {
          if (j(e)) {
            const t = H(e).code;
            if (typeof t === "number") {
              s = t;
            }
          }
        };
        try {
          const n = new URLSearchParams({
            variables: JSON.stringify({
              hasQuery: true,
              query: e
            }),
            doc_id: N.SEARCH,
            server_timestamps: "true"
          });
          const {
            resp: i,
            data: a
          } = await $(T.GRAPHQL, {
            ...t,
            "content-type": "application/x-www-form-urlencoded"
          }, {
            method: "POST",
            body: n.toString()
          });
          if (i.status === 200) {
            const e = a && a.data && a.data.xdt_api__v1__fbsearch__non_profiled_serp;
            const t = e && e.users || [];
            const s = t.find(e => String(e && e.username || "").toLowerCase() === o);
            const n = s && (s.id || s.pk || s.pk_id);
            if (n) {
              return {
                id: String(n),
                user: s,
                source: "graphql_fbsearch"
              };
            }
          } else {
            s = i.status;
          }
        } catch (i) {
          n(i);
        }
        try {
          const n = `${T.TOPSEARCH}?${new URLSearchParams({
            context: "blended",
            query: e,
            include_reel: "false"
          }).toString()}`;
          const {
            resp: i,
            data: a
          } = await $(n, t);
          if (i.status === 200) {
            const e = a && a.users || [];
            const t = e.find(e => String(e && e.user && e.user.username || "").toLowerCase() === o);
            const s = t && t.user && (t.user.pk || t.user.id);
            if (s) {
              return {
                id: String(s),
                user: t.user,
                source: "topsearch"
              };
            }
          } else {
            s = i.status;
          }
        } catch (i) {
          n(i);
        }
        return {
          id: null,
          lastStatus: s
        };
      }
      async function Xe(e) {
        const t = await J();
        for (const s of qe(e)) {
          try {
            const {
              resp: e,
              data: o
            } = await $(s, t);
            if (e.status === 200 && o && o.user) {
              return {
                user: o.user,
                url: s
              };
            }
            if (K(o)) {
              throw We(o);
            }
          } catch (o) {
            if (j(o) && H(o).code === "IG_REJECTED") {
              throw o;
            }
          }
        }
        return {
          user: null
        };
      }
      async function Je(e) {
        const t = await J();
        const o = {
          id: String(e),
          render_surface: "PROFILE",
          __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
          __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
          __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: false,
          __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
          enable_integrity_filters: true
        };
        const s = new URLSearchParams({
          variables: JSON.stringify(o),
          doc_id: N.PROFILE,
          server_timestamps: "true"
        });
        const {
          resp: n,
          data: i
        } = await $(T.GRAPHQL, {
          ...t,
          "content-type": "application/x-www-form-urlencoded"
        }, {
          method: "POST",
          body: s.toString()
        });
        if (K(i)) {
          throw We(i);
        }
        if (n.status === 200 && i && i.data && i.data.user) {
          return i.data.user;
        } else {
          return null;
        }
      }
      async function Ze(e) {
        const t = await J();
        const o = [`${T.FRIENDSHIP_WWW}${encodeURIComponent(e)}/`, `${T.FRIENDSHIP_I}${encodeURIComponent(e)}/`];
        for (const n of o) {
          try {
            const {
              resp: e,
              data: o
            } = await $(n, t);
            if (e.status !== 200 || !o) {
              continue;
            }
            if (typeof o.following === "boolean") {
              return {
                following: o.following,
                followed_by: Boolean(o.followed_by)
              };
            }
            const s = o.friendship_status || o;
            if (typeof s.following === "boolean") {
              return {
                following: s.following,
                followed_by: Boolean(s.followed_by)
              };
            }
          } catch (s) {}
        }
        return null;
      }
      async function $e(e) {
        const t = M(e);
        if (!t) {
          throw D({
            code: "USER_NOT_FOUND",
            kind: L.FATAL,
            message: "Instagram profile not found, please check your input."
          });
        }
        const o = await ze(t);
        if (!o || !o.id) {
          const e = o && o.lastStatus || 0;
          if (e === 400 || e === 401 || e === 403 || e === 429) {
            throw Q({
              status: e,
              statusText: "",
              url: T.GRAPHQL
            });
          }
          throw D({
            code: "USER_NOT_FOUND",
            kind: L.FATAL,
            message: "Instagram profile not found, please check your input."
          });
        }
        let s = null;
        try {
          const e = await Xe(o.id);
          if (e.user) {
            s = e.user;
          }
        } catch (a) {
          if (!j(a)) {
            throw a;
          }
        }
        if (!s) {
          try {
            s = await Je(o.id);
          } catch (a) {
            if (!j(a)) {
              throw a;
            }
          }
        }
        if (!s && o.user) {
          s = o.user;
        }
        const n = z(s, o.id);
        if (!n) {
          throw D({
            code: "NO_PROFILE_DATA",
            kind: L.FATAL,
            message: "No profile data was scraped for this user. Please try again later."
          });
        }
        const i = n.data.user;
        if (i.is_private && i.followed_by_viewer !== true) {
          const e = await Ze(i.id);
          if (e && typeof e.following === "boolean") {
            i.followed_by_viewer = e.following;
            i.friendship_status = {
              ...(i.friendship_status || {}),
              following: e.following,
              followed_by: e.followed_by
            };
          }
        }
        return n;
      }
      var et = {
        name: "ExportView",
        data() {
          return {
            vipFlag: true,
            isFree: false,
            hid: "",
            isResume: false,
            userInfo: {
              id: "",
              userName: "shopify",
              followers: 2437439,
              following: 1681,
              exportType: "Followers"
            },
            user: "",
            configInfo: null,
            contactVisible: false,
            processStatus: "loading",
            statusTip: "",
            coolingSec: 0,
            coolingToken: 0,
            intervalSec: b,
            intervalSaveTimer: null,
            loopInfo: {
              limitUpper: 500,
              size: 50,
              endCursor: "",
              hasNextPage: true,
              timerId: null,
              pageCount: 0,
              retried: false,
              percent: 0
            },
            spinning: true,
            columns: [{
              title: "Avatar",
              dataIndex: "avatar",
              key: "avatar",
              scopedSlots: {
                customRender: "avatar"
              }
            }, {
              title: "Username",
              dataIndex: "username",
              key: "username"
            }, {
              title: "Full Name",
              dataIndex: "fullName",
              key: "fullName",
              ellipsis: true
            }, {
              title: "User ID",
              dataIndex: "userId",
              key: "userId",
              ellipsis: true
            }, {
              title: "Followed By You",
              dataIndex: "followed",
              key: "followed",
              scopedSlots: {
                customRender: "followed"
              },
              align: "center"
            }],
            dataSource: []
          };
        },
        computed: {
          linkMail() {
            if (this.configInfo) {
              return this.configInfo.linkMail || "";
            } else {
              return "hello@igexport.net";
            }
          },
          userCode() {
            if (this.user) {
              return this.user.shareCode || "";
            } else {
              return "null";
            }
          },
          homeUrl() {
            return this.configInfo && this.configInfo.homeUrl || "https://igexport.net";
          },
          faqsUrl() {
            return this.configInfo && this.configInfo.faqsUrl || "https://igexport.net/#FAQ";
          },
          moreObj() {
            return this.configInfo && this.configInfo.moreObj || {
              moreUrl: "",
              moreList: []
            };
          }
        },
        mounted() {
          this.initData();
        },
        watch: {
          dataSource: {
            immediate: true,
            deep: true,
            handler(e) {
              this.loopInfo.percent = parseInt(e.length / this.loopInfo.limitUpper * 100);
              if (this.loopInfo.percent > 100) {
                this.loopInfo.percent = 100;
              }
              let t = e.length - this.loopInfo.limitUpper;
              if (t > 0 && t < this.loopInfo.size) {
                this.loopInfo.size = t;
              }
            }
          },
          processStatus(e) {
            if (e === "finished" || e === "nothing") {
              if (this.loopInfo.timerId) {
                clearTimeout(this.loopInfo.timerId);
                this.loopInfo.timerId = null;
              }
            }
          },
          intervalSec(e) {
            const t = Number(e);
            if (t > 0) {
              if (this.intervalSaveTimer) {
                clearTimeout(this.intervalSaveTimer);
              }
              this.intervalSaveTimer = setTimeout(() => {
                this.intervalSaveTimer = null;
                w.set(y.SCRAPE_INTERVAL, t);
              }, 500);
            }
          }
        },
        methods: {
          async initData() {
            if (!this.$route.query.userName || !this.$route.query.type) {
              this.$message.warning("Access Exception");
              return;
            }
            this.userInfo.userName = this.$route.query.userName;
            this.userInfo.exportType = this.$route.query.type;
            let e = await ce.getUserInfo(true);
            this.user = e;
            if (e) {
              if (e.f) {
                this.isFree = e.f;
              }
              if (e.vipFlag || e.f) {
                this.loopInfo.limitUpper = Number.MAX_SAFE_INTEGER;
                this.vipFlag = true;
              } else {
                this.vipFlag = false;
              }
            }
            this.configInfo = await ce.getConfigInfo(true);
            const t = await w.get(y.SCRAPE_INTERVAL, b);
            const o = Number(t);
            if (o > 0) {
              this.intervalSec = o;
            }
            if (this.$route.query.hid) {
              const e = await Oe(this.$route.query.hid);
              if (e) {
                await this.applyHistoryRecord(e);
              } else {
                this.hid = xe();
              }
            } else {
              this.hid = xe();
            }
            chrome.cookies.get({
              url: "https://www.instagram.com",
              name: "csrftoken"
            }, e => {
              if (!e) {
                this.processStatus = "nothing";
                this.$message.warning("Has No Data");
                this.spinning = false;
                return;
              }
              if (this.isResume && this.userInfo.id) {
                this.spinning = false;
                this.loop();
              } else {
                this.getUserInfo();
              }
            });
          },
          async applyHistoryRecord(e) {
            this.hid = e.hid;
            this.isResume = true;
            this.userInfo.id = e.profileId;
            this.userInfo.userName = e.matchParam.userName || this.userInfo.userName;
            this.userInfo.exportType = e.matchParam.type || this.userInfo.exportType;
            if (e.matchParam.type === "Followers") {
              this.userInfo.followers = e.totalCount;
            } else {
              this.userInfo.following = e.totalCount;
            }
            this.loopInfo.endCursor = e.endCursor || "";
            this.loopInfo.hasNextPage = e.hasNextPage !== false;
            if (!this.vipFlag && this.loopInfo.limitUpper > I) {
              this.loopInfo.limitUpper = I;
            }
            if (this.loopInfo.limitUpper > e.totalCount) {
              this.loopInfo.limitUpper = e.totalCount;
            }
            this.dataSource = [...(e.dataSource || [])];
            if (e.completeFlag) {
              this.processStatus = "finished";
            }
          },
          async saveCurrentToHistory() {
            if (!this.hid) {
              return;
            }
            const e = this.userInfo.exportType === "Followers" ? this.userInfo.followers : this.userInfo.following;
            await Te({
              hid: this.hid,
              matchParam: {
                type: this.userInfo.exportType,
                userName: this.userInfo.userName
              },
              profileId: this.userInfo.id,
              endCursor: this.loopInfo.endCursor || "",
              hasNextPage: !!this.loopInfo.hasNextPage,
              completeFlag: !this.loopInfo.hasNextPage,
              totalCount: e || 0,
              dataSource: [...this.dataSource]
            });
          },
          async handleHitLimit() {
            this.processStatus = "finished";
            await this.saveCurrentToHistory();
            if (this.loopInfo.hasNextPage && !this.vipFlag) {
              const e = this;
              p.A.confirm({
                title: "Upgrade to Pro",
                content: "Free users can extract up to 500 followers/following per task. Upgrade to Pro for unlimited.",
                centered: true,
                okText: "Upgrade",
                cancelText: "Maybe later",
                async onOk() {
                  await e.openPRO();
                }
              });
            }
          },
          messageForKind(e, t) {
            if (e === L.FATAL) {
              return t || "This user does not exist. Please check the username and try again.";
            } else if (e === L.NEEDS_VERIFY) {
              return "Instagram requires a quick account verification. Please open instagram.com, complete it, then come back and click START to continue.";
            } else if (e === L.RATE_LIMITED) {
              return "Instagram rate limit detected. Please wait a few minutes, or switch to another Instagram account, then click START to continue.";
            } else {
              return "Could not reach Instagram. Please check your network, then click START to continue.";
            }
          },
          async getUserInfo() {
            let e;
            try {
              e = await $e(this.userInfo.userName);
            } catch (s) {
              const e = j(s) ? H(s) : {
                kind: "",
                message: ""
              };
              const t = this;
              p.A.error({
                content: this.messageForKind(e.kind, e.message),
                centered: true,
                onOk() {
                  window.location.href = t.homeUrl;
                }
              });
              this.spinning = false;
              return;
            }
            const t = e.data.user;
            this.userInfo.id = t.id;
            this.userInfo.followers = t.edge_followed_by.count;
            this.userInfo.following = t.edge_follow.count;
            const o = await this.getCurrentIgUserId();
            if (t.is_private && !t.followed_by_viewer && String(t.id) !== String(o)) {
              const e = this;
              p.A.warning({
                title: "Private account",
                content: `@${this.userInfo.userName} is a private account. You need to follow this user first before exporting their followers/following.`,
                centered: true,
                onOk() {
                  window.location.href = e.homeUrl;
                }
              });
              this.spinning = false;
              return;
            }
            if (this.userInfo.exportType === "Followers" && this.userInfo.followers > 0 && this.loopInfo.limitUpper > this.userInfo.followers) {
              this.loopInfo.limitUpper = this.userInfo.followers;
            }
            if (this.userInfo.exportType === "Following" && this.userInfo.following > 0 && this.loopInfo.limitUpper > this.userInfo.following) {
              this.loopInfo.limitUpper = this.userInfo.following;
            }
            await this.saveCurrentToHistory();
            this.spinning = false;
            this.loop();
          },
          getCurrentIgUserId() {
            return new Promise(e => {
              chrome.cookies.get({
                url: "https://www.instagram.com",
                name: "ds_user_id"
              }, t => e(t && t.value ? t.value : ""));
            });
          },
          async dealFollowers(e = "add") {
            if (e === "init") {
              this.dataSource = [];
              this.loopInfo.endCursor = "";
            }
            const t = this.loopInfo.limitUpper - this.dataSource.length;
            if (t <= 0) {
              await this.handleHitLimit();
              return;
            }
            const o = Math.min(this.loopInfo.size, t);
            let s = await te({
              query_hash: U.FOLLOWERS,
              variables: JSON.stringify({
                id: this.userInfo.id,
                after: this.loopInfo.endCursor,
                first: o
              })
            });
            if (!s || !s.data || !s.data.user || !s.data.user.edge_followed_by) {
              throw D({
                code: "NO_PAGE_DATA",
                kind: L.NEEDS_VERIFY,
                message: "Instagram returned no data for this page."
              });
            }
            const n = s.data.user.edge_followed_by;
            if (!n.edges || n.edges.length <= 0) {
              this.loopInfo.endCursor = n.page_info ? n.page_info.end_cursor : "";
              this.loopInfo.hasNextPage = !!n.page_info && n.page_info.has_next_page;
              this.loopInfo.retried = false;
              await this.saveCurrentToHistory();
              return;
            }
            n.edges.forEach(e => {
              if (this.dataSource.length < this.loopInfo.limitUpper) {
                this.dataSource.push({
                  avatar: "https://cdn.getwebooster.workers.dev/" + e.node.profile_pic_url,
                  username: this.clearAllHashSign(e.node.username),
                  fullName: this.clearAllHashSign(e.node.full_name),
                  userId: e.node.id,
                  followed: e.node.followed_by_viewer ? "Yes" : "No"
                });
              }
            });
            this.loopInfo.endCursor = n.page_info.end_cursor;
            this.loopInfo.hasNextPage = n.page_info.has_next_page;
            this.loopInfo.retried = false;
            await this.saveCurrentToHistory();
          },
          async dealFollowing(e = "add") {
            if (e === "init") {
              this.dataSource = [];
              this.loopInfo.endCursor = "";
            }
            const t = this.loopInfo.limitUpper - this.dataSource.length;
            if (t <= 0) {
              await this.handleHitLimit();
              return;
            }
            const o = Math.min(this.loopInfo.size, t);
            let s = await te({
              query_hash: U.FOLLOWING,
              variables: JSON.stringify({
                id: this.userInfo.id,
                after: this.loopInfo.endCursor,
                first: o
              })
            });
            if (!s || !s.data || !s.data.user || !s.data.user.edge_follow) {
              throw D({
                code: "NO_PAGE_DATA",
                kind: L.NEEDS_VERIFY,
                message: "Instagram returned no data for this page."
              });
            }
            const n = s.data.user.edge_follow;
            if (!n.edges || n.edges.length <= 0) {
              this.loopInfo.endCursor = n.page_info ? n.page_info.end_cursor : "";
              this.loopInfo.hasNextPage = !!n.page_info && n.page_info.has_next_page;
              this.loopInfo.retried = false;
              await this.saveCurrentToHistory();
              return;
            }
            n.edges.forEach(e => {
              if (this.dataSource.length < this.loopInfo.limitUpper) {
                this.dataSource.push({
                  avatar: "https://cdn.getwebooster.workers.dev/" + e.node.profile_pic_url,
                  username: this.clearAllHashSign(e.node.username),
                  fullName: this.clearAllHashSign(e.node.full_name),
                  userId: e.node.id,
                  followed: e.node.followed_by_viewer ? "Yes" : "No"
                });
              }
            });
            this.loopInfo.endCursor = n.page_info.end_cursor;
            this.loopInfo.hasNextPage = n.page_info.has_next_page;
            this.loopInfo.retried = false;
            await this.saveCurrentToHistory();
          },
          normalizeIntervalInput() {
            if (!(Number(this.intervalSec) > 0)) {
              this.intervalSec = b;
            }
          },
          scheduleNextPage() {
            if (this.loopInfo.timerId) {
              clearTimeout(this.loopInfo.timerId);
            }
            const e = Number(this.intervalSec) > 0 ? Number(this.intervalSec) : b;
            const t = e * 1000;
            this.loopInfo.timerId = setTimeout(() => this.runOnePage(), F(t));
          },
          loop() {
            this.scheduleNextPage();
          },
          async runOnePage() {
            this.loopInfo.timerId = null;
            if (this.processStatus === "loading") {
              if (this.loopInfo.hasNextPage) {
                try {
                  if (this.userInfo.exportType === "Following") {
                    await this.dealFollowing("add");
                  } else {
                    await this.dealFollowers("add");
                  }
                } catch (e) {
                  await this.handlePageError(e);
                  return;
                }
                if (this.processStatus === "loading") {
                  if (!(this.dataSource.length <= 0)) {
                    if (this.dataSource.length >= this.loopInfo.limitUpper) {
                      this.loopInfo.limitUpper = this.dataSource.length;
                      this.processStatus = "finished";
                      return;
                    } else {
                      if (this.loopInfo.hasNextPage) {
                        this.loopInfo.pageCount++;
                        if (this.loopInfo.pageCount % _ !== 0) {
                          this.scheduleNextPage();
                        } else {
                          this.enterCooling(S, "To protect your Instagram account, the task will continue automatically in a moment.");
                        }
                      } else {
                        this.processStatus = "finished";
                      }
                      return;
                    }
                  }
                  this.processStatus = "nothing";
                }
              } else {
                this.processStatus = "finished";
              }
            }
          },
          async handlePageError(e) {
            try {
              const t = j(e) ? H(e) : {
                kind: "",
                message: ""
              };
              await this.saveCurrentToHistory();
              if (t.kind === L.RETRYABLE && !this.loopInfo.retried) {
                this.loopInfo.retried = true;
                this.scheduleNextPage();
                return;
              }
              this.loopInfo.retried = false;
              if (t.kind === L.RATE_LIMITED) {
                this.enterCooling(v, this.messageForKind(t.kind, t.message));
                return;
              }
              this.processStatus = "suspended";
              this.statusTip = this.messageForKind(t.kind, t.message);
            } catch (t) {
              this.loopInfo.retried = false;
              this.processStatus = "suspended";
              this.statusTip = "Something went wrong while saving progress. Click START to continue.";
            }
          },
          enterCooling(e, t) {
            this.processStatus = "cooling";
            this.statusTip = t;
            this.coolingSec = e;
            this.coolingToken++;
            this.tickCooling(this.coolingToken);
          },
          tickCooling(e) {
            if (this.processStatus === "cooling" && e === this.coolingToken) {
              if (this.coolingSec <= 0) {
                this.statusTip = "";
                this.processStatus = "loading";
                this.scheduleNextPage();
                return;
              }
              this.coolingSec--;
              setTimeout(() => this.tickCooling(e), 1000);
            }
          },
          stop() {
            if (this.loopInfo.timerId) {
              clearTimeout(this.loopInfo.timerId);
              this.loopInfo.timerId = null;
            }
            this.coolingSec = 0;
            this.coolingToken++;
            this.statusTip = "";
            this.processStatus = "stopping";
          },
          start() {
            this.statusTip = "";
            this.loopInfo.retried = false;
            this.processStatus = "loading";
            this.scheduleNextPage();
          },
          toRowArr(e) {
            let t = [["Avatar", "Username", "Full Name", "User ID", "Followed By You"]];
            e.forEach(e => {
              e.avatar = e.avatar.replace("https://cdn.getwebooster.workers.dev/", "");
              let o = Object.keys(e);
              let s = o.map(function (t) {
                return e[t];
              });
              t.push(s);
            });
            return t;
          },
          arrayToCsv(e, t = {}) {
            let o = t.columnDelimiter || ",";
            let s = t.lineDelimiter || "\n";
            e = this.toRowArr(e);
            return e.reduce((e, t) => {
              let n;
              n = Array.isArray(t) ? t.reduce((e, t) => {
                let n = e ? e + o : e;
                if (t) {
                  let e = t.toString().replace(new RegExp(s, "g"), " ");
                  n += /,/.test(e) ? `"${e}"` : e;
                }
                return n;
              }, "") : t;
              return (e ? e + s : "") + n;
            }, "");
          },
          downloadCsv(e, t = "export.csv") {
            let o = "﻿";
            if (navigator.msSaveOrOpenBlob) {
              let s = new Blob([o + e], {
                type: "text/csv;charset=utf-8;"
              });
              navigator.msSaveOrOpenBlob(s, t);
            } else {
              let s = encodeURI(`data:text/csv;charset=utf-8,${o}${e}`);
              let n = document.createElement("a");
              n.href = s;
              n.download = t;
              document.body.appendChild(n);
              n.click();
              document.body.removeChild(n);
            }
          },
          cliDownLoad() {
            let e = JSON.parse(JSON.stringify(this.dataSource));
            let t = this.arrayToCsv(e);
            this.downloadCsv(t, "IGExport_Followers_" + this.userInfo.userName + "_" + new Date().getTime() + ".csv");
          },
          clearAllHashSign(e) {
            if (e) {
              return e.replace(/#/g, "");
            } else {
              return e;
            }
          },
          async openPRO() {
            if (this.configInfo && this.configInfo.payUrl) {
              chrome.windows.create({
                url: this.configInfo.payUrl + "?uid=" + this.user.id,
                type: "popup",
                state: "fullscreen"
              });
            }
          },
          openMoreUrl() {
            window.open(this.moreObj.moreUrl, "_blank");
          },
          openFaqs() {
            window.open(this.faqsUrl, "_blank");
          },
          jumpTo(e) {
            window.open(e, "_blank");
          }
        }
      };
      var tt = et;
      var ot = (0, a.A)(tt, Qe, Ye, false, null, "3ec6e3b1", null);
      var st = ot.exports;
      s.Ay.use(u.Ay);
      const nt = [{
        path: "/home",
        name: "home",
        component: Ke
      }, {
        path: "/export",
        name: "export",
        component: st
      }, {
        path: "/about",
        name: "about",
        component: () => o.e(594).then(o.bind(o, 70808))
      }];
      const it = new u.Ay({
        mode: "hash",
        base: "/",
        routes: nt
      });
      var at = it;
      var rt = o(1910);
      s.Ay.use(rt.Ay);
      var lt = new rt.Ay.Store({
        state: {},
        getters: {},
        mutations: {},
        actions: {},
        modules: {}
      });
      o(28616);
      var ct = o(41956);
      o(67685);
      var ut = o(9233);
      o(32967);
      var dt = o(53453);
      o(5515);
      var gt = o(39699);
      o(46303);
      var pt = o(78862);
      o(10472);
      var ft = o(80809);
      o(20723);
      var ht = o(52330);
      o(57611);
      var mt = o(36051);
      o(6705);
      var At = o(86047);
      o(5920);
      var wt = o(17774);
      o(48763);
      var yt = o(39466);
      o(1766);
      var It = o(99340);
      o(18073);
      var vt = o(43947);
      o(55695);
      var _t = o(31257);
      function St() {
        return new Promise((e, t) => {
          chrome.tabs.query({
            active: true,
            currentWindow: true
          }, o => {
            let s = o.length ? o[0].id : null;
            if (s) {
              e(s);
            } else {
              t("获取的当前tabId为空。");
            }
          });
        });
      }
      function bt(e) {
        this.port = null;
        this.type = e;
        this.connect = async function () {
          if (this.type === "CS") {
            let e = await St();
            this.port = chrome.tabs.connect(e, {
              name: "qimo-cs"
            });
          } else {
            if (this.type !== "BG") {
              throw new Error("未知类型:" + this.type);
            }
            this.port = chrome.runtime.connect({
              name: "qimo-bg"
            });
          }
        };
        this.on = function (e, t) {
          if (!this.port) {
            throw new Error("还未初始化通信组件，请先进行连接connect。");
          }
          this.port.onMessage.addListener(o => {
            if (o.key === e) {
              t(o.message);
            }
          });
        };
        this.send = function (e, t) {
          if (!this.port) {
            throw new Error("还未初始化通信组件，请先进行连接connect。");
          }
          let o = {
            key: e,
            message: t
          };
          this.port.postMessage(o);
        };
      }
      s.Ay.component(_t.A.name, _t.A);
      s.Ay.component(vt.A.name, vt.A);
      s.Ay.component(It.A.name, It.A);
      s.Ay.component(yt.A.name, yt.A);
      s.Ay.component(wt.A.name, wt.A);
      s.Ay.component(At.A.name, At.A);
      s.Ay.component(mt.A.name, mt.A);
      s.Ay.component(ht.A.name, ht.A);
      s.Ay.component(ft.A.name, ft.A);
      s.Ay.component(pt.Ay.name, pt.Ay);
      s.Ay.component(pt.Ay.TabPane.name, pt.Ay.TabPane);
      s.Ay.component(p.A.name, p.A);
      s.Ay.component(gt.A.name, gt.A);
      s.Ay.component(dt.A.name, dt.A);
      s.Ay.component(ut.A.name, ut.A);
      s.Ay.prototype.$message = ct.A;
      let Ct = new bt("BG");
      let kt = new bt("CS");
      s.Ay.prototype.$bex = {
        bg: Ct,
        cs: kt
      };
      s.Ay.config.productionTip = false;
      s.Ay.prototype.$cStorage = w;
      new s.Ay({
        router: at,
        store: lt,
        render: e => e(c)
      }).$mount("#app");
    },
    53111: function (e) {
      e.exports = "data:image/png;base64,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";
    },
    77764: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAD1BMVEUAAAD///////////////+PQt5oAAAABHRSTlMAgL9ARyeO/QAAAXVJREFUOMuFVIGRgzAMS4EBCs0A0GaAUBiAGO8/0ws7R1Xu/pqjl9iKZJmQhnPMzyRTH66jTWqj3L/zNz3H/bp/WnI7DxckqSyVGlU++bdKJtH9XDOdo6gvLrhqqZVdlSu6cKdjeKfpo9Yg4RusjUIUsWJwEWWZycBqWh0yR7LZydhonrA4PAhpHboQb4pF7Bg0yHQOZPKVDXCG0ktFkQ5xY/KFgQ1OHQCNm0cLiA9XbeJzQBYPmNkIZEtAOpgj98fAFm5yAXQ75gI5Bjp1oEFW798ApLyh1YtkrgF7OzxnGE86MQCtbK80+XdV+3AtUMoguY3FAZBMS/BTwC4Jdqf5PLQ5Bu8WXk3dKD47gLMwdaeUCsTNgKB7jRH4YsS6lnVjFcFk7KbG4GtvE57NdpqWI9IPihZ8b5LvCwcloW/Y6/RJXkhs/1+DanTn/FvLr6sWVlq3SV+sWiqyJKvIPqdHbpdBVfLPvwxHoqex/zr6IcnzcYZ/QdJQjN/7E/wAAAAASUVORK5CYII=";
    },
    73119: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAPFBMVEUAAAD////////////////////////////////////////////////////////////////////////////YSWgTAAAAE3RSTlMAgEC/zLLdk3kg7ubStZlgWUkXZAvNvQAAAJ5JREFUSMft0ckKwzAMRdEXeYozJ+///7UmoTiFQqRNB8hZeKULwsJb4gqBnrC4gzv4iyCwCLpRV0TuoiuCYplKs1jii4QrueNJl3Gp5UkLhaHOD9BYarBAZXzOj5Y7m249cTdBKx9Bhlp7fKlBT/awmMkZJt7DRgTfszUGG7DSZEWkSQSNfiNwrjyNPvCAp0DMgXWlz/1SokkCAg0CHuR3O3+dyh7fAAAAAElFTkSuQmCC";
    },
    21614: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAARVBMVEUAAAD/RVX/RFT/RFb/RVb/RVX/RVb/RVb/RFb/Qlr/RVX/RVb/RVb/RVb/RVb/Rlf/RFj/Q1f/RFb/RVb/RVb/Rlf/RVZwRGmsAAAAFnRSTlMAv0CA8GPWnS8Hybd2cmpLJBnpsuVY/8v2HQAAAKtJREFUSMft00sOwyAMRVEHQiD/X/v2v9QqQZUSC3AZdBTOmAsykqko/qpdnco4/u4B1O7Xy6cOp66liMqjwzo0+LKxAKcjWPSGi+rGjjxoe6RNLFggaFigIKhZYCDYWaClB2YWWIRpzzhiQS/MSjxoEKHCgdqin8NIs5rMgBgxmHKDPTcwmYHNm6FLLNALIXNq45Z5ADcmgoMB44SARtwMFKA98tTVSsVjfQCAbDpWGYMVIQAAAABJRU5ErkJggg==";
    },
    50869: function (e) {
      e.exports = "data:image/png;base64,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";
    },
    91449: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAD1BMVEUAAAD///////////////+PQt5oAAAABHRSTlMAQIC/o1TdDAAAAS1JREFUOMuFlIGxgyAMhgN1AOl1AGs7gE8ZwAL7z/SSNIkFzva/E898R0JCIpDcdYtFtc2gcmJV5cnsrUYGz9Ipkd3T5jWIrvODHJCzWyl/oFIXL3zxxpZk9jS14ILhaamtbiUvCwwltX5e8uw1KBjgxmBRUwggh7ngE4sV4F2MyCAz0Dw5M59H8Ai0MPGjGAb46KJFthOQMqzB45o5ngGPToRPFRjQID72CjxLsrwrECV/yqAC7El8fQJnwOm3ATgDo5Az4A18Dw5Rb2Vojns7EkxfS/K7iBCRTOFxtO35RcW65zMI6JrB7jxaatQ+oxW/bTgFCVPbodPAIPWAGppnoZGjU/PSD440scnamwvbEEfDaeM838NbNs7nPwAM3yqPWozOrpq3w7rd2f4PhTOADDH4LzAAAAAASUVORK5CYII=";
    },
    81665: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAD1BMVEUAAAA+Pj48PDw9PT09PT02s1CAAAAABHRSTlMAgEC/+QGcAgAAATdJREFUOMt9VNEVwjAIrLED1NoBYswAajNA03T/maR45Ix9Tz4s4TggBOyq3OZUnpfuV1zaVPLQ2k9bFSL0PyK7fQ7e3SZRCu1RjgEliLoyAfnNQfiPpo6MzKbRz6vSG5eUBSWBQEpRByPc0/YcYPEaKX/s2hHEeChxsTJxB/giUpS7X7caXX9AX2v0bv+clGY4rhrl02tYwycDFst9/gDRTqsAmhtEuhnggv8K5aS6JAVAWPsBOEttBqjKJ87GNMAIgwEMRUKbgw9wBCYlWB+0ctZKIFbAEegFkF4Q4AQue7+Ym9kG+FGYrZkqctFplfvI3NqH0uQwX1bZYxLQAXYoypkjiqHmY3CouQbTi2tg2tA8Sv6zalxO3CHYYHOd8+hdmLHO5FOK//uXQWSi/49crqnMYz2+Aeb7XnURuzI+AAAAAElFTkSuQmCC";
    },
    44471: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAD1BMVEUAAAD///////////////+PQt5oAAAABHRSTlMAgEC/+QGcAgAAATdJREFUOMt9VNEVwjAIrLED1NoBYswAajNA03T/maR45Ix9Tz4s4TggBOyq3OZUnpfuV1zaVPLQ2k9bFSL0PyK7fQ7e3SZRCu1RjgEliLoyAfnNQfiPpo6MzKbRz6vSG5eUBSWBQEpRByPc0/YcYPEaKX/s2hHEeChxsTJxB/giUpS7X7caXX9AX2v0bv+clGY4rhrl02tYwycDFst9/gDRTqsAmhtEuhnggv8K5aS6JAVAWPsBOEttBqjKJ87GNMAIgwEMRUKbgw9wBCYlWB+0ctZKIFbAEegFkF4Q4AQue7+Ym9kG+FGYrZkqctFplfvI3NqH0uQwX1bZYxLQAXYoypkjiqHmY3CouQbTi2tg2tA8Sv6zalxO3CHYYHOd8+hdmLHO5FOK//uXQWSi/49crqnMYz2+Aeb7XnURuzI+AAAAAElFTkSuQmCC";
    },
    34170: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAATlBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////+QlxstAAAAGXRSTlMAKYHU8L6gX0QO5ce5llNL2LKOfW9nFzYwoxtJ+QAAAJlJREFUSMft1LkOwjAQhOFdHyG3IYTAvv+LQoHE4WI8EhZNvjp/4cge2dV3W9Mm5VxvD8Oh+Ht7OrVSYraXSQVb7E04dzAY7IOHR7FvYwuCXKNkYMF1IMgcLyDIxQQCeBQcmFcQoAIHNrFBZIPABj0bjGywVP6tXqtejZjI6131ATX60xGI7Mw4MGR4Kvkx5uceu67zJrs/uAOZcUEzWlUrEgAAAABJRU5ErkJggg==";
    },
    18906: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAQAAAD9CzEMAAAAVElEQVR4nO2WsREAIQzD2Dj7ZYtM5G++pAhwbkBKH9mdxwCAKQqlavFS0X2f2iV76U8IZ/5eB9WRoBAgQIAAAQIECK4R2IeXezrax+/fwjnfAZ7jA+pwx4b7N9PeAAAAAElFTkSuQmCC";
    },
    88920: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAD1BMVEUAAAD///////////////+PQt5oAAAABHRSTlMAgL9ARyeO/QAAAM5JREFUOMu90lEOgyAMBuCKHgATDuCcB9gWDiDY+59pyGhhsTU+LOuDIJ/pTxBoqnuAXN2kgNs0iEonxDbEtlBDDMy1E2INmWHZGuAQH9Kr5U4c0mMAj4GBQ1wGtNSJQrp9MmBShkjTdQe0pVMJMZggPyNDDlnyaEprh1hmfh9t+dISROg/C2UMyUuI+wIcCW68CRQLTmCR1qMGIYHTwF8GOuVBgvUMjASTCPSHNOgvA18jCUAH+RSjDHzTNPAaPMdDWfhXveZD3bXtbj+FN9rWsxd9hjOpAAAAAElFTkSuQmCC";
    },
    45548: function (e) {
      e.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAD1BMVEUAAAA0NDQzMzM0NDQzMzP9aoyIAAAABHRSTlMAgL9ARyeO/QAAAM5JREFUOMu90lEOgyAMBuCKHgATDuCcB9gWDiDY+59pyGhhsTU+LOuDIJ/pTxBoqnuAXN2kgNs0iEonxDbEtlBDDMy1E2INmWHZGuAQH9Kr5U4c0mMAj4GBQ1wGtNSJQrp9MmBShkjTdQe0pVMJMZggPyNDDlnyaEprh1hmfh9t+dISROg/C2UMyUuI+wIcCW68CRQLTmCR1qMGIYHTwF8GOuVBgvUMjASTCPSHNOgvA18jCUAH+RSjDHzTNPAaPMdDWfhXveZD3bXtbj+FN9rWsxd9hjOpAAAAAElFTkSuQmCC";
    }
  };
  var t = {};
  function o(s) {
    var n = t[s];
    if (n !== undefined) {
      return n.exports;
    }
    var i = t[s] = {
      id: s,
      loaded: false,
      exports: {}
    };
    e[s].call(i.exports, i, i.exports, o);
    i.loaded = true;
    return i.exports;
  }
  o.m = e;
  (function () {
    var e = [];
    o.O = function (t, s, n, i) {
      if (!s) {
        var a = Infinity;
        for (u = 0; u < e.length; u++) {
          s = e[u][0];
          n = e[u][1];
          i = e[u][2];
          var r = true;
          for (var l = 0; l < s.length; l++) {
            if ((i & false || a >= i) && Object.keys(o.O).every(function (e) {
              return o.O[e](s[l]);
            })) {
              s.splice(l--, 1);
            } else {
              r = false;
              if (i < a) {
                a = i;
              }
            }
          }
          if (r) {
            e.splice(u--, 1);
            var c = n();
            if (c !== undefined) {
              t = c;
            }
          }
        }
        return t;
      }
      i = i || 0;
      for (var u = e.length; u > 0 && e[u - 1][2] > i; u--) {
        e[u] = e[u - 1];
      }
      e[u] = [s, n, i];
    };
  })();
  (function () {
    o.n = function (e) {
      var t = e && e.__esModule ? function () {
        return e.default;
      } : function () {
        return e;
      };
      o.d(t, {
        a: t
      });
      return t;
    };
  })();
  (function () {
    o.d = function (e, t) {
      for (var s in t) {
        if (o.o(t, s) && !o.o(e, s)) {
          Object.defineProperty(e, s, {
            enumerable: true,
            get: t[s]
          });
        }
      }
    };
  })();
  (function () {
    o.f = {};
    o.e = function (e) {
      return Promise.all(Object.keys(o.f).reduce(function (t, s) {
        o.f[s](e, t);
        return t;
      }, []));
    };
  })();
  (function () {
    o.u = function (e) {
      return "scripts/react-about-chunk.js";
    };
  })();
  (function () {
    o.miniCssF = function (e) {};
  })();
  (function () {
    o.g = function () {
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
    o.o = function (e, t) {
      return Object.prototype.hasOwnProperty.call(e, t);
    };
  })();
  (function () {
    var e = {};
    var t = "ig-followers:";
    o.l = function (s, n, i, a) {
      if (e[s]) {
        e[s].push(n);
      } else {
        var r;
        var l;
        if (i !== undefined) {
          for (var c = document.getElementsByTagName("script"), u = 0; u < c.length; u++) {
            var d = c[u];
            if (d.getAttribute("src") == s || d.getAttribute("data-webpack") == t + i) {
              r = d;
              break;
            }
          }
        }
        if (!r) {
          l = true;
          r = document.createElement("script");
          r.charset = "utf-8";
          r.timeout = 120;
          if (o.nc) {
            r.setAttribute("nonce", o.nc);
          }
          r.setAttribute("data-webpack", t + i);
          r.src = s;
        }
        e[s] = [n];
        function g(t, o) {
          r.onerror = r.onload = null;
          clearTimeout(p);
          var n = e[s];
          delete e[s];
          if (r.parentNode) {
            r.parentNode.removeChild(r);
          }
          if (n) {
            n.forEach(function (e) {
              return e(o);
            });
          }
          if (t) {
            return t(o);
          }
        }
        var p = setTimeout(g.bind(null, undefined, {
          type: "timeout",
          target: r
        }), 120000);
        r.onerror = g.bind(null, r.onerror);
        r.onload = g.bind(null, r.onload);
        if (l) {
          document.head.appendChild(r);
        }
      }
    };
  })();
  (function () {
    o.r = function (e) {
      if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
        Object.defineProperty(e, Symbol.toStringTag, {
          value: "Module"
        });
      }
      Object.defineProperty(e, "__esModule", {
        value: true
      });
    };
  })();
  (function () {
    o.nmd = function (e) {
      e.paths = [];
      e.children ||= [];
      return e;
    };
  })();
  (function () {
    o.j = 887;
  })();
  (function () {
    o.p = "/";
  })();
  (function () {
    var e = {
      887: 0
    };
    o.f.j = function (t, s) {
      var n = o.o(e, t) ? e[t] : undefined;
      if (n !== 0) {
        if (n) {
          s.push(n[2]);
        } else {
          var i = new Promise(function (o, s) {
            n = e[t] = [o, s];
          });
          s.push(n[2] = i);
          var a = o.p + o.u(t);
          var r = new Error();
          function l(s) {
            if (o.o(e, t) && (n = e[t], n !== 0 && (e[t] = undefined), n)) {
              var i = s && (s.type === "load" ? "missing" : s.type);
              var a = s && s.target && s.target.src;
              r.message = "Loading chunk " + t + " failed.\n(" + i + ": " + a + ")";
              r.name = "ChunkLoadError";
              r.type = i;
              r.request = a;
              n[1](r);
            }
          }
          o.l(a, l, "chunk-" + t, t);
        }
      }
    };
    o.O.j = function (t) {
      return e[t] === 0;
    };
    function t(t, s) {
      var n;
      var i;
      var a = s[0];
      var r = s[1];
      var l = s[2];
      var c = 0;
      if (a.some(function (t) {
        return e[t] !== 0;
      })) {
        for (n in r) {
          if (o.o(r, n)) {
            o.m[n] = r[n];
          }
        }
        if (l) {
          var u = l(o);
        }
      }
      for (t && t(s); c < a.length; c++) {
        i = a[c];
        if (o.o(e, i) && e[i]) {
          e[i][0]();
        }
        e[i] = 0;
      }
      return o.O(u);
    }
    var s = self.webpackChunkig_followers = self.webpackChunkig_followers || [];
    s.forEach(t.bind(null, 0));
    s.push = t.bind(null, s.push.bind(s));
  })();
  var s = o.O(undefined, [504], function () {
    return o(46288);
  });
  s = o.O(s);
})();