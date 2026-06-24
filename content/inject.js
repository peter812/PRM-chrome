// inject.js - Clean, unminified page context script for Instagram downloader with zero tracking
// Extends inject2.js with loadUserFeed procedure for PRM post importing.

(() => {
    "use strict";

    // -------------------------------------------------------------
    // 1. Navigation / History Interceptor
    // -------------------------------------------------------------
    function initHistoryInterceptor() {
        const originalPushState = history.pushState;
        history.pushState = function() {
            if (arguments[2] && arguments[2].startsWith("https://") && arguments[2].includes("?img_index=")) {
                arguments[2] = "?" + arguments[2].split("?")[1];
            }
            const result = originalPushState.apply(this, arguments);
            window.dispatchEvent(new Event("pushstate"));
            window.dispatchEvent(new Event("locationchange"));
            return result;
        };

        const originalReplaceState = history.replaceState;
        history.replaceState = function() {
            if (arguments[2] && arguments[2].startsWith("https://") && arguments[2].includes("?img_index=")) {
                arguments[2] = "?" + arguments[2].split("?")[1];
            }
            const result = originalReplaceState.apply(this, arguments);
            window.dispatchEvent(new Event("replacestate"));
            window.dispatchEvent(new Event("locationchange"));
            return result;
        };

        window.addEventListener("popstate", () => {
            window.dispatchEvent(new Event("locationchange"));
        });
    }

    // -------------------------------------------------------------
    // 2. React Fiber Inspection & DOM Tagging
    // -------------------------------------------------------------
    function initReactFiberTagger() {
        // Only run if option hash is not present
        if (location.hash === "#__ig_downloader_options") return;

        // Message receiver to load post details using Instagram's internal modules
        window.addEventListener("message", async (event) => {
            if (event.origin === "https://www.instagram.com" && event.ports && event.ports.length > 0 && event.data && event.data.procedure) {
                const data = event.data;
                if (data.procedure === "loadPostFromShortcode") {
                    const shortcode = data.shortcode;
                    try {
                        const cometRelay = window.require("CometRelay");
                        const polarisEnv = window.require("PolarisRelayEnvironment");
                        const postQuery = window.require("PolarisPostActionLoadPostQuery").POST_QUERY;

                        const response = await cometRelay.fetchQuery(polarisEnv, postQuery, {
                            child_comment_count: 3,
                            fetch_comment_count: 40,
                            has_threaded_comments: true,
                            parent_comment_count: 24,
                            shortcode: shortcode
                        }).toPromise();

                        const inlineFragment = response.xdt_shortcode_media.__fragments.PolarisPostActionLoadPostQueryInlineFragment 
                            || response.xdt_shortcode_media.__fragments.PolarisPostActionLoadPostQueryInlineFragmentWithoutRelatedProfiles;

                        event.ports[0].postMessage(inlineFragment);
                    } catch (err) {
                        console.error("Failed to load post from shortcode " + shortcode + ":", err);
                        event.ports[0].postMessage(undefined);
                    }
                    return;
                }
                
                if (data.procedure === "loadUserFeed") {
                    const username = data.username;
                    try {
                        InstagramApi.init();
                        const api = InstagramApi._instances[PolarisModules.INSTA_API];
                        if (!api) {
                            event.ports[0].postMessage({ success: false, error: "PolarisInstapi not found" });
                            return;
                        }
                        const response = await api.apiGet(`/api/v1/feed/user/${username}/username/`);
                        event.ports[0].postMessage({ success: true, feed: response.data });
                    } catch (err) {
                        console.error("Failed to load user feed for " + username + ":", err);
                        event.ports[0].postMessage({ success: false, error: err.message || String(err) });
                    }
                    return;
                }
                
                event.ports[0].postMessage(undefined);
            }
        });

        // Claim helper
        function updateClaim() {
            try {
                sessionStorage.setItem("__ig_www_claim", window.require("PolarisWWWClaim").getWWWClaim());
            } catch (err) {
                setTimeout(updateClaim, 100);
            }
        }

        // App ID helper
        function updateAppId() {
            try {
                sessionStorage.setItem("__ig_app_id", window.require("PolarisConfig").getIGAppID());
            } catch (err) {
                setTimeout(updateAppId, 100);
            }
        }

        // Require status check
        function checkRequire() {
            const hasRequire = typeof window.require === "function" ? "1" : "";
            if (hasRequire !== sessionStorage.getItem("__ig_has_require")) {
                sessionStorage.setItem("__ig_has_require", hasRequire);
            }
            if (!hasRequire) {
                setTimeout(checkRequire, 1000);
            }
        }

        // Run updates
        updateAppId();
        updateClaim();
        checkRequire();

        // Listen for storage changes to refresh claims
        window.addEventListener("storage", (e) => {
            if (e.key && !e.key.startsWith("__ig_") && e.oldValue && e.newValue && (e.oldValue === "0" || e.newValue.startsWith("hmac.") || e.key.includes("www"))) {
                updateClaim();
            }
        });

        // DOM node tagger
        function isValidId(id) {
            return typeof id === "string" && /^\d+$/.test(id);
        }

        function findIdInFiberAncestors(node, limit, currentDepth = 0) {
            if (!node) return null;
            if (node.memoizedProps && node.memoizedProps.id) return node.memoizedProps.id;
            if (node.memoizedProps && node.memoizedProps.post && node.memoizedProps.post.id) return node.memoizedProps.post.id;
            if (node.memoizedProps && node.memoizedProps.media && node.memoizedProps.media.pk) return node.memoizedProps.media.pk;
            if (node.memoizedProps && node.memoizedProps.postId) return node.memoizedProps.postId;
            if (node.id) return node.id;
            if (currentDepth >= limit) return node.memoizedProps ? node.memoizedProps.id : null;
            return findIdInFiberAncestors(node.return, limit, currentDepth + 1);
        }

        function findKeyInFiberAncestors(node, limit, currentDepth = 0) {
            if (!node) return null;
            if (node.key || currentDepth >= limit) return node.key;
            return findKeyInFiberAncestors(node.return, limit, currentDepth + 1);
        }

        function extractIdFromReactFiber(element) {
            if (!element) return;
            for (const key of Object.keys(element)) {
                if (key.startsWith("__reactFiber$")) {
                    const fiber = element[key];
                    try {
                        const id = fiber.return.memoizedProps.id;
                        if (id && isValidId(id)) return id;
                    } catch (e) {}

                    if (fiber.child) {
                        try {
                            const id = fiber.child.memoizedProps.id;
                            if (id && isValidId(id)) return id;
                        } catch (e) {}
                    }

                    if (fiber.return) {
                        try {
                            const id = fiber.return.memoizedProps.post.id;
                            if (id) return id;
                        } catch (e) {}
                        try {
                            const id = fiber.return.memoizedProps.postId;
                            if (id) return id;
                        } catch (e) {}
                    }

                    if (fiber.return && fiber.return.return) {
                        try {
                            const id = fiber.return.return.memoizedProps.videoFBID;
                            if (id) return id;
                        } catch (e) {}
                        try {
                            const id = fiber.return.return.memoizedProps.id;
                            if (id && isValidId(id)) return id;
                        } catch (e) {}
                    }

                    try {
                        const id = fiber.return.return.return.return.return.memoizedProps.id;
                        if (id && isValidId(id)) return id;
                    } catch (e) {}

                    try {
                        let k = fiber.return.return.return.return.return.return.key;
                        if (k) return k.split("_")[0];
                    } catch (e) {}

                    try {
                        let k = fiber.return.return.return.return.return.return.return.return.key;
                        if (k) return k.split("_")[0];
                    } catch (e) {}

                    let foundId = findIdInFiberAncestors(fiber, 20, 0);
                    if (foundId && /^\d+$/.test(foundId)) return foundId;

                    let foundKey = findKeyInFiberAncestors(fiber, 20, 0);
                    if (foundKey) {
                        if (/^\d+_\d+$/.test(foundKey)) return foundKey.split("_")[0];
                        if (/^\d+$/.test(foundKey)) return foundKey;
                    }
                }
            }
        }

        function tagElementsWithId(container) {
            if (!container || typeof container.querySelectorAll !== "function") return;

            container.querySelectorAll("._aatk._aiao > div").forEach(el => {
                const id = extractIdFromReactFiber(el);
                if (id && isValidId(id)) el.setAttribute("__igdl_id", id);
            });

            container.querySelectorAll("video").forEach(el => {
                const id = extractIdFromReactFiber(el);
                if (id && isValidId(id)) el.setAttribute("__igdl_id", id);
            });

            container.querySelectorAll("article").forEach(el => {
                const id = extractIdFromReactFiber(el);
                if (id && isValidId(id)) el.setAttribute("__igdl_id", id);
            });

            container.querySelectorAll("a._a6hd").forEach(el => {
                const id = extractIdFromReactFiber(el);
                if (id && isValidId(id)) el.setAttribute("__igdl_id", id);
            });

            const complexSelector = ".x9f619.xjbqb8w.x1lliihq.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1n2onr6.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1";
            container.querySelectorAll(complexSelector).forEach(el => {
                const id = extractIdFromReactFiber(el);
                if (id && isValidId(id)) {
                    el.setAttribute("__igdl_id", id);
                    el.querySelectorAll("a._a6hd").forEach(child => child.setAttribute("__igdl_id", id));
                }
            });

            container.querySelectorAll("img").forEach(el => {
                if (el.parentNode && el.parentNode.parentNode) {
                    const id = extractIdFromReactFiber(el.parentNode.parentNode);
                    if (id && isValidId(id)) {
                        el.setAttribute("__igdl_id", id);
                        return;
                    }
                }
                if (el.parentNode && el.parentNode.parentNode && el.parentNode.parentNode.parentNode) {
                    const id = extractIdFromReactFiber(el.parentNode.parentNode.parentNode);
                    if (id && isValidId(id)) {
                        el.setAttribute("__igdl_id", id);
                    }
                }
            });
        }

        const observerConfig = { attributes: true, childList: true, subtree: true };
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes[0] && typeof mutation.addedNodes[0].querySelector === "function") {
                    tagElementsWithId(mutation.addedNodes[0]);
                }
                if (mutation.target && typeof mutation.target.querySelector === "function") {
                    tagElementsWithId(mutation.target);
                }
            }
        });

        function startObserver() {
            try {
                const body = document.querySelector("body");
                observer.observe(body, observerConfig);
                tagElementsWithId(body);
            } catch (err) {
                setTimeout(startObserver, 50);
            }
        }
        startObserver();
    }

    // -------------------------------------------------------------
    // 3. Instagram Private API Wrapper
    // -------------------------------------------------------------
    const PolarisModules = {
        INSTA_API: "PolarisInstapi",
        INSTA_AJAX: "PolarisInstajax",
        COOKIES: "PolarisCookies",
        CONFIG: "PolarisConfig",
        MEDIA_CONSTS: "PolarisMediaConstants",
        STORIES_STRINGS: "PolarisStoriesStrings"
    };

    class InstagramApi {
        static init() {
            if (!this._instances) {
                this._instances = {};
                for (const key of Object.keys(PolarisModules)) {
                    const moduleName = PolarisModules[key];
                    this._instances[moduleName] = this._getModule(moduleName);
                }
            }
        }

        static _getModule(name) {
            if (window.require) {
                try {
                    return window.require(name);
                } catch (err) {
                    // Silently ignore module load issues
                }
            }
            return null;
        }

        static async getStoryReelsTray() {
            const api = this._instances[PolarisModules.INSTA_API];
            if (!api) return null;

            const requestConfig = {
                method: "apiGet",
                url: "/api/v1/feed/reels_tray/",
                data: {
                    query: { is_following_feed: false }
                }
            };

            const { data } = await api[requestConfig.method](requestConfig.url, requestConfig.data);
            return data.tray;
        }

        static async getStoryReelMedia(reelIds, mediaId = null) {
            const api = this._instances[PolarisModules.INSTA_API];
            if (!api) return null;

            const requestConfig = {
                method: "apiGet",
                url: "/api/v1/feed/reels_media/",
                data: {
                    query: {
                        media_id: mediaId ? mediaId.join(",") : "",
                        reel_ids: reelIds.join(",")
                    }
                }
            };

            const { data } = await api[requestConfig.method](requestConfig.url, requestConfig.data);
            return data;
        }

        static getMediaTypes() {
            const mediaConsts = this._instances[PolarisModules.MEDIA_CONSTS];
            return mediaConsts ? mediaConsts.MediaTypes : null;
        }

        static getViewStoryStringParts(usernameObj) {
            const strings = this._instances[PolarisModules.STORIES_STRINGS];
            if (!strings) return null;

            const subtitlePart = strings.viewStorySubtitleText(usernameObj ? usernameObj.username : undefined);
            const viewStoryPart = strings.VIEW_STORY;

            return {
                subtitleText: subtitlePart && subtitlePart.$1 ? subtitlePart.$1[0] : undefined,
                viewStory: viewStoryPart && viewStoryPart.$1 ? viewStoryPart.$1[0] : undefined
            };
        }
    }
    InstagramApi._instances = null;

    // -------------------------------------------------------------
    // 4. Message Bridge
    // -------------------------------------------------------------
    const MessageTypes = {
        STORY_INIT: "story_init",
        STORY_REELS_DATA_FETCH: "story_reels_data_fetch",
        STORY_REELS_TRAY: "story_reels_tray",
        STORY_DOWNLOAD: "story_download",
        STORY_REEL_MEDIA: "story_reel_media",
        STORY_REEL_FETCH: "story_reel_fetch",
        STORY_UI_UPDATE: "story_ui_update"
    };

    const ButtonActions = {
        ADD_DOWNLOAD_BUTTON: "add_download_button",
        REMOVE_DOWNLOAD_BUTTON: "remove_download_button"
    };

    class MessageBridge {
        constructor() {
            this._subscribers = {};
            window.addEventListener("message", this.handleMessages.bind(this));
        }

        handleMessages(event) {
            const message = event.data;
            if (!message) return;

            const { type, payload } = message;
            if (this._subscribers[type]) {
                for (const callback of this._subscribers[type]) {
                    callback(payload);
                }
            }
        }

        removeListener(type, callback) {
            if (!this._subscribers[type]) return;
            const index = this._subscribers[type].indexOf(callback);
            if (index !== -1) {
                this._subscribers[type].splice(index, 1);
            }
        }

        onMessage(type, callback) {
            if (!this._subscribers[type]) {
                this._subscribers[type] = [];
            }
            if (!this._subscribers[type].includes(callback)) {
                this._subscribers[type].push(callback);
            }
            return () => this.removeListener(type, callback);
        }

        sendMessage(type, payload) {
            window.postMessage({ type, payload });
        }
    }

    // -------------------------------------------------------------
    // 5. URL Route Parser
    // -------------------------------------------------------------
    const PageTypes = {
        HOME: "home",
        POST: "post",
        EXPLORE: "explore",
        STORY: "story",
        CHANNEL: "channel",
        TV: "tv",
        SAVED: "saved",
        TAGGED: "tagged",
        ACCOUNT: "account",
        REELS: "reels",
        REELS_FEED: "reels_feed"
    };

    class RouteParser {
        static isStoriesRoute(path) {
            return /^\/?stories\/[a-zA-Z0-9._]{3,}\/([\d]+)?\/?(?:[?&a-zA-Z0-9=%\-_.~])*?$/gs.test(path);
        }

        static parseUrlData(structure, actualPath) {
            const structParts = structure.split("/");
            const actualParts = actualPath.split("/");
            const result = {};

            for (let i = 0; i < structParts.length; i++) {
                let part = structParts[i];
                if (!part || part.trim() === "" || part[0] !== "{") {
                    continue;
                }

                part = part.slice(1, -1);
                if (part.trim() === "") continue;

                const isOptional = part.startsWith("?");
                const keyName = isOptional ? part.slice(1) : part;

                if (i < actualParts.length) {
                    result[keyName] = actualParts[i];
                } else if (!isOptional) {
                    result[keyName] = null;
                }
            }
            return result;
        }

        static parseType(path) {
            if (this.isStoriesRoute(path)) {
                return PageTypes.STORY;
            }
            return null;
        }

        static parseData(path) {
            const type = this.parseType(path);
            if (!type) return null;

            const structure = this.urlStructures[type];
            return this.parseUrlData(structure, path);
        }
    }
    RouteParser.urlStructures = {
        [PageTypes.STORY]: "/stories/{username}/{?initial_media_id}/"
    };

    // -------------------------------------------------------------
    // 6. UI Button Controller
    // -------------------------------------------------------------
    class StoryUiController {
        constructor() {
            this.activeListeners = {};
            this.messageHandler = new MessageBridge();

            const messageHandlers = {
                [MessageTypes.STORY_INIT]: this.init.bind(this),
                [MessageTypes.STORY_REELS_DATA_FETCH]: this.getReelsTrayData.bind(this),
                [MessageTypes.STORY_UI_UPDATE]: this.handleUIChanges.bind(this),
                [MessageTypes.STORY_REEL_FETCH]: this.getReelData.bind(this)
            };

            for (const [type, handler] of Object.entries(messageHandlers)) {
                this.activeListeners[type] = this.messageHandler.onMessage(type, handler);
            }
        }

        init() {
            InstagramApi.init();
        }

        getReelsTrayData() {
            InstagramApi.getStoryReelsTray()
                .then(tray => {
                    if (tray) {
                        this.messageHandler.sendMessage(MessageTypes.STORY_REELS_TRAY, tray);
                    } else {
                        console.error("Story reels tray came back empty.");
                    }
                })
                .catch(error => {
                    console.error("Failed to fetch story reels tray:", error);
                });
        }

        getReelData({ reel_id, media_id, all }) {
            InstagramApi.getStoryReelMedia([reel_id])
                .then(data => {
                    if (!data || !data.reels || !data.reels[reel_id]) {
                        console.error("Failed to resolve reel media data.");
                        return;
                    }

                    const user = data.reels[reel_id].user;
                    const reelsMedia = data.reels_media;

                    if (!reelsMedia || reelsMedia.length < 1) {
                        console.error("No reels media items found.");
                        return;
                    }

                    this.messageHandler.sendMessage(MessageTypes.STORY_REEL_MEDIA, {
                        user,
                        reel_id,
                        all,
                        items: all || !media_id ? reelsMedia[0].items : reelsMedia[0].items.filter(item => item.pk === media_id)
                    });
                })
                .catch(error => {
                    console.error("Failed to fetch story reel media:", error);
                });
        }

        handleUIChanges({ type }) {
            const routeData = RouteParser.parseData(location.pathname);

            switch (type) {
                case ButtonActions.ADD_DOWNLOAD_BUTTON: {
                    if (document.getElementById("story-download-button")) return;

                    const headerContainer = (() => {
                        const mountEl = document.querySelector('[id^="mount_"]');
                        if (!mountEl) return null;

                        const anchorTags = mountEl.querySelectorAll('a[href]:has(>img[src]:not([alt*=" "])):not([href^="/stories/"])');
                        const targetAnchor = anchorTags.length > 0 
                            ? anchorTags.item(anchorTags.length - 1) 
                            : mountEl.querySelector('a[href]:has(>img[src]):not([href^="/stories/"])');

                        const headerEl = targetAnchor ? (targetAnchor.closest("header") || targetAnchor.closest(".x6s0dn4.x78zum5.x1xmf6yo")) : null;
                        return headerEl ? headerEl.children[1] : null;
                    })();

                    if (!headerContainer) return;

                    const shouldRender = (() => {
                        if (!routeData) return false;
                        if (routeData.username === "highlights") return true;

                        const stringParts = InstagramApi.getViewStoryStringParts(routeData);
                        if (!stringParts) return true;

                        if (headerContainer.parentElement) {
                            const viewStoryBtn = document.evaluate(
                                `//div[@role='button' and .='${stringParts.viewStory}']`, 
                                headerContainer.parentElement.parentElement || document.body, 
                                null, 
                                XPathResult.ANY_UNORDERED_NODE_TYPE, 
                                null
                            ).singleNodeValue;

                            const subtitleEl = document.evaluate(
                                `//div[contains(., '${stringParts.subtitleText}')]`, 
                                headerContainer.parentElement.parentElement || document.body, 
                                null, 
                                XPathResult.ANY_UNORDERED_NODE_TYPE, 
                                null
                            ).singleNodeValue;

                            if (viewStoryBtn || subtitleEl) {
                                return false;
                            }
                        }
                        return true;
                    })();

                    if (!shouldRender) return;

                    const buttonWrapper = document.createElement("div");
                    buttonWrapper.id = "story-download-button";
                    buttonWrapper.style.display = "flex";

                    const downloadCurrentBtn = document.createElement("span");
                    downloadCurrentBtn.classList.add("story-download-button");
                    downloadCurrentBtn.title = "Download current story";
                    downloadCurrentBtn.onclick = () => {
                        const currentRoute = RouteParser.parseData(location.pathname);
                        if (currentRoute) {
                            this.messageHandler.sendMessage(MessageTypes.STORY_DOWNLOAD, {
                                ...currentRoute,
                                all: false
                            });
                        }
                    };

                    const downloadAllBtn = document.createElement("span");
                    downloadAllBtn.classList.add("story-download-button", "story-download-all-button");
                    downloadAllBtn.title = "Download all stories";
                    downloadAllBtn.onclick = () => {
                        const currentRoute = RouteParser.parseData(location.pathname);
                        if (currentRoute) {
                            this.messageHandler.sendMessage(MessageTypes.STORY_DOWNLOAD, {
                                ...currentRoute,
                                all: true
                            });
                        }
                    };

                    buttonWrapper.append(downloadCurrentBtn, downloadAllBtn);

                    if (headerContainer.children.length > 1) {
                        headerContainer.children[1].prepend(buttonWrapper);
                    } else {
                        headerContainer.insertBefore(buttonWrapper, headerContainer.children[1] || headerContainer.lastChild);
                    }
                    break;
                }

                case ButtonActions.REMOVE_DOWNLOAD_BUTTON: {
                    const buttonWrapper = document.getElementById("story-download-button");
                    if (buttonWrapper) {
                        buttonWrapper.remove();
                    }
                    break;
                }
            }
        }
    }

    // -------------------------------------------------------------
    // 7. Initialization
    // -------------------------------------------------------------
    initHistoryInterceptor();
    initReactFiberTagger();
    new StoryUiController();
})();
