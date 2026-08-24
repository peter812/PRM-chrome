(function () {
    "use strict";
    var e = {
        35710: function (e, t, n) {
            n(14603),
                n(47566),
                n(98721),
                n(44114);
            function o() {
                var e = (new Date).getTime()
                    , t = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (function (t) {
                        var n = (e + 16 * Math.random()) % 16 | 0;
                        return e = Math.floor(e / 16),
                            ("x" == t ? n : 3 & n | 8).toString(16)
                    }
                    ));
                return t
            }
            const r = function () {
                let e = {}
                    , t = {}
                    , n = []
                    , r = {};
                return chrome.runtime.onConnect.addListener((o => {
                    n.push(o);
                    let s = o.postMessage;
                    o._postMessage = e => {
                        s.call(o, e)
                    }
                        ,
                        o.postMessage = (e, t) => {
                            o._postMessage({
                                key: e,
                                message: t
                            })
                        }
                        ,
                        o.onMessage.addListener((function (n) {
                            if (n.key && e[n.key])
                                e[n.key](n.message, o, (e => {
                                    n.cid && o._postMessage({
                                        cid: n.cid,
                                        message: e
                                    })
                                }
                                ));
                            else if (n.cid && t[n.cid]) {
                                if (r["beforeResponse"] && !1 === r["beforeResponse"](n.message, o))
                                    return !1;
                                t[n.cid](n.message, o),
                                    delete t[n.cid],
                                    r["afterResponse"] && r["afterResponse"](n.message, o)
                            }
                            r["after"] && r["after"](n.message, o)
                        }
                        ))
                }
                )),
                {
                    add(t, n) {
                        "string" === typeof t ? e[t] = n : "object" === typeof t && Object.keys(t).forEach((n => {
                            e[n] = t[n]
                        }
                        ))
                    },
                    rm(t) {
                        delete e[t]
                    },
                    postMessage(e, s, i) {
                        if (r["before"] && !1 === r["before"](e, s, i, port))
                            return !1;
                        let a = o();
                        i && (t[a] = i),
                            n.forEach(((t, o) => {
                                try {
                                    i ? t._postMessage({
                                        key: e,
                                        message: s,
                                        cid: a
                                    }) : t._postMessage({
                                        key: e,
                                        message: s
                                    })
                                } catch (r) {
                                    n.splice(o, 1)
                                }
                            }
                            ))
                    },
                    on(e, t) {
                        r[e] = t
                    },
                    un(e) {
                        delete r[e]
                    }
                }
            }
                , s = function () {
                    return {
                        get(e, t = null) {
                            return new Promise((n => {
                                let o = {};
                                o[e] = t,
                                    chrome.storage.sync.get(o, (t => {
                                        n(t[e])
                                    }
                                    ))
                            }
                            ))
                        },
                        set(e, t) {
                            return new Promise((n => {
                                let o = {};
                                o[e] = t,
                                    chrome.storage.sync.set(o, (() => {
                                        n(t)
                                    }
                                    ))
                            }
                            ))
                        }
                    }
                }
                , i = new s;
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
                n = n.toUpperCase(),
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
                }
                    , s = await a.get(c.ACCESS_TOKEN);
                s && (r.headers.miniapp_token = s),
                    t && "GET" !== n && Object.defineProperty(r, "body", {
                        value: JSON.stringify(t)
                    });
                try {
                    const t = await fetch(e, r)
                        , n = await t.json();
                    if (200 === n.code)
                        return n.result;
                    throw new Error(n.message)
                } catch (i) {
                    throw new Error(i)
                }
            }
                ;
            const f = e => u("/extensions/userInfo", e)
                , _ = e => u("/user/login", e, "post");
            chrome.runtime.onInstalled.addListener((async e => {
                "install" === e.reason && (chrome.runtime.setUninstallURL("https://igexport.net/suggestion"),
                    chrome.tabs.create({
                        url: "https://igexport.net"
                    }))
            }
            ));
            let l = new r;
            async function d(e = !1) {
                let t = await a.get(c.ACCESS_TOKEN)
                    , n = await a.get(c.USER_INFO);
                return !t || !e && n || (n = await f(),
                    await a.set(c.USER_INFO, n)),
                    n
            }
            async function g(e) {
                let t = {
                    appid: "nmaifnjhioogfcdidhimgjdhahgaibko",
                    anonymousCode: "nmaifnjhioogfcdidhimgjdhahgaibko_" + e,
                    identity: "igFollowers"
                }
                    , n = await _(t);
                if (n) {
                    await a.set(c.ACCESS_TOKEN, n.accessToken);
                    let e = await d(!0);
                    l.postMessage("BgLogin-Respone", e)
                } else
                    l.postMessage("BgLogin-Respone", null)
            }
            l.add("sendBg", (function (e) {
                l.postMessage("cskey-bg", "我是background页面")
            }
            )),
                l.add("content_script", (function (e) { }
                )),
                l.add("BgLogin", (function (e) {
                    e && g(e)
                }
                ))
        }
    }
        , t = {};
    function n(o) {
        var r = t[o];
        if (void 0 !== r)
            return r.exports;
        var s = t[o] = {
            id: o,
            loaded: !1,
            exports: {}
        };
        return e[o].call(s.exports, s, s.exports, n),
            s.loaded = !0,
            s.exports
    }
    n.m = e,
        function () {
            var e = [];
            n.O = function (t, o, r, s) {
                if (!o) {
                    var i = 1 / 0;
                    for (f = 0; f < e.length; f++) {
                        o = e[f][0],
                            r = e[f][1],
                            s = e[f][2];
                        for (var a = !0, c = 0; c < o.length; c++)
                            (!1 & s || i >= s) && Object.keys(n.O).every((function (e) {
                                return n.O[e](o[c])
                            }
                            )) ? o.splice(c--, 1) : (a = !1,
                                s < i && (i = s));
                        if (a) {
                            e.splice(f--, 1);
                            var u = r();
                            void 0 !== u && (t = u)
                        }
                    }
                    return t
                }
                s = s || 0;
                for (var f = e.length; f > 0 && e[f - 1][2] > s; f--)
                    e[f] = e[f - 1];
                e[f] = [o, r, s]
            }
        }(),
        function () {
            n.n = function (e) {
                var t = e && e.__esModule ? function () {
                    return e["default"]
                }
                    : function () {
                        return e
                    }
                    ;
                return n.d(t, {
                    a: t
                }),
                    t
            }
        }(),
        function () {
            n.d = function (e, t) {
                for (var o in t)
                    n.o(t, o) && !n.o(e, o) && Object.defineProperty(e, o, {
                        enumerable: !0,
                        get: t[o]
                    })
            }
        }(),
        function () {
            n.g = function () {
                if ("object" === typeof globalThis)
                    return globalThis;
                try {
                    return this || new Function("return this")()
                } catch (e) {
                    if ("object" === typeof window)
                        return window
                }
            }()
        }(),
        function () {
            n.o = function (e, t) {
                return Object.prototype.hasOwnProperty.call(e, t)
            }
        }(),
        function () {
            n.nmd = function (e) {
                return e.paths = [],
                    e.children || (e.children = []),
                    e
            }
        }(),
        function () {
            n.j = 471
        }(),
        function () {
            var e = {
                471: 0
            };
            n.O.j = function (t) {
                return 0 === e[t]
            }
                ;
            var t = function (t, o) {
                var r, s, i = o[0], a = o[1], c = o[2], u = 0;
                if (i.some((function (t) {
                    return 0 !== e[t]
                }
                ))) {
                    for (r in a)
                        n.o(a, r) && (n.m[r] = a[r]);
                    if (c)
                        var f = c(n)
                }
                for (t && t(o); u < i.length; u++)
                    s = i[u],
                        n.o(e, s) && e[s] && e[s][0](),
                        e[s] = 0;
                return n.O(f)
            }
                , o = self["webpackChunkig_followers"] = self["webpackChunkig_followers"] || [];
            o.forEach(t.bind(null, 0)),
                o.push = t.bind(null, o.push.bind(o))
        }();
    var o = n.O(void 0, [504], (function () {
        return n(35710)
    }
    ));
    o = n.O(o)
}
)();
