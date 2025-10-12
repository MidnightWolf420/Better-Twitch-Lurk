let indexedDBStores = ["settings", "lastMessage"];
let dbName = "BetterTwitchLurkDB";
let isSending = false;
let lastEnabledState;
let emoteList = [];
let oldStreamInfo;
let streamInfo;
let isFollowing;
let oldChannel;
let channel;

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            indexedDBStores.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            });
        };
        request.onsuccess = async () => {
            let db = request.result;
            const missingStores = indexedDBStores.filter(name => !db.objectStoreNames.contains(name));
            if (missingStores.length > 0) {
                db.close();
                const newVersion = db.version + 1;
                const upgradeRequest = indexedDB.open(dbName, newVersion);
                upgradeRequest.onupgradeneeded = (e) => {
                    const upgradeDb = e.target.result;
                    missingStores.forEach(storeName => {
                        if (!upgradeDb.objectStoreNames.contains(storeName)) {
                            upgradeDb.createObjectStore(storeName);
                        }
                    });
                };
                upgradeRequest.onsuccess = () => resolve(upgradeRequest.result);
                upgradeRequest.onerror = () => reject(upgradeRequest.error);
            } else {
                resolve(db);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

async function saveSetting(key, value, storeName = "settings") {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.put(value, key);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getSetting(key, defaultValue = null, storeName = "settings") {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(key);
        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result !== undefined ? request.result : defaultValue);
            request.onerror = () => resolve(defaultValue);
        });
    } catch {
        return defaultValue;
    }
}

function getCountdownValue(date) {
    const remaining = date - Date.now();
    let display = "";

    if (remaining > 0) {
        const totalSeconds = Math.floor(remaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) display += `${hours} Hour${hours > 1 ? "s" : ""} `;
        if (minutes > 0) display += `${minutes} Minute${minutes > 1 ? "s" : ""} `;
        display += `${seconds} Second${seconds !== 1 ? "s" : ""}`;
    } else {
        display = "0 Second";
    }

    return `Time Until Next Message: ${display}`;
}

async function emoteWhitelistMenu() {
    function attachHandlers() {
        var emoteButtons = document.querySelectorAll(".emote-picker__scroll-container [data-test-selector='emote-button-clickable']");
        for (var i = 0; i < emoteButtons.length; i++) {
            (function (button) {
                if (!button.getAttribute('onclick')) {
                    button.setAttribute('onclick', `
                    (function(event){
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        var emoteElement = event.target.closest("[data-test-selector='emote-button-clickable']");
                        if(emoteElement){
                            var img = emoteElement.querySelector("img");
                            if(img){
                                var name = img.getAttribute("alt");
                                var id = img.src.match(/\\/emoticons\\/v2\\/([^\\/]+)\\/default/)[1];
                                Promise.resolve(getValue("whitelistedEmotes", {})).then(function(result){
                                    var whitelistedEmotes = new Map(Object.entries(result));
                                    if(!whitelistedEmotes.has(id)){
                                        whitelistedEmotes.set(id, {id: id, token: name});
                                        return setValue("whitelistedEmotes", Object.fromEntries(whitelistedEmotes));
                                    }
                                });
                            }
                        }
                    })(event)
                    `);
                }
            })(emoteButtons[i]);
        }
    }

    const interval = setInterval(() => {
        const targetElement = document.querySelector(".emote-picker__tab-content");
        if (!targetElement || targetElement.offsetParent === null) {
            clearInterval(interval);
            return;
        }
        attachHandlers();
    }, 500);
}


async function getRandomEmotes(count = 1) {
    if (!emoteList?.length) return [];

    const whitelisted = await getSetting("whitelistedEmotes", null);
    const whitelistIds = whitelisted && Object.keys(whitelisted).length > 0?new Set(Object.keys(whitelisted)):null;

    let allEmotes = emoteList.flatMap(set => set.emotes.map(emote => ({ ...emote, owner: set.owner })).filter(Boolean)
    );

    if (whitelistIds) {
        const filtered = allEmotes.filter(emote => whitelistIds.has(emote.id));
        if (filtered.length > 0) allEmotes = filtered;
    }

    if (!allEmotes.length) return [];

    const weighted = allEmotes.map(emote => {
        let weight = 1;
        if (emote.owner?.login === channel?.login) weight = 1500;
        else if (emote.type === "GLOBALS") weight = 850;
        else if (emote.type === "HYPE_TRAIN") weight = 600;
        else if (emote.type === "SUBSCRIPTIONS") weight = 300;
        return { emote, weight };
    });

    const result = [];
    for (let i = 0; i < count; i++) {
        let total = weighted.reduce((sum, e) => sum + e.weight, 0);
        let random = Math.random() * total;

        for (const { emote, weight } of weighted) {
            if (random < weight) {
                result.push(emote);
                break;
            }
            random -= weight;
        }
    }

    return result;
}

async function waitForElementVisible(selector, timeout = 5000, shouldReject = true) {
    return new Promise((resolve, reject) => {
        const intervalTime = 100;
        let elapsed = 0;

        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            if (el && el.offsetParent !== null) {
                clearInterval(interval);
                resolve(el);
            } else if ((elapsed += intervalTime) >= timeout) {
                clearInterval(interval);
                if (shouldReject) {
                    reject(new Error(`Element "${selector}" not found after ${timeout}ms`));
                } else {
                    resolve(null);
                }
            }
        }, intervalTime);
    });
}

async function waitForElementsVisible(selector, count = 1, timeout = 5000, shouldReject = true) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkExistence = () => {
            const elements = Array.from(document.querySelectorAll(selector)).filter(el => el.offsetParent !== null);

            if (elements.length >= count) {
                resolve(elements);
            } else if (Date.now() - startTime > timeout) {
                if (shouldReject) {
                    reject(new Error(`Expected ${count} visible elements, but found ${elements.length}`));
                } else {
                    resolve(null);
                }
            } else {
                requestAnimationFrame(checkExistence);
            }
        };

        checkExistence();
    });
}

function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
}

async function clickEmoteSection(emote) {
    let selector;
    let sectionName;

    switch (emote.type) {
        case "HYPE_TRAIN":
            selector = "HYPE_TRAIN_EMOTES";
            sectionName = "Hype Train";
            break;
        case "GLOBALS":
            selector = "GLOBAL_EMOTES";
            sectionName = "Global";
            break;
        default:
            if(emote.owner) {
                selector = `category-ref-${emote.owner.displayName}`;
                sectionName = emote.owner.displayName;
            }
            break;
    }

    if (!selector) return;

    const button = document.querySelector(`button[data-a-target="${selector}"]`);
    if (button) {
        button.click();
        console.log(`[BetterTwitchLurk] Clicked Emote Section "${sectionName}"`);
    }
}

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function selectEmotes(emotes) {
    document.querySelectorAll(".emote-picker__scroll-container [data-test-selector='emote-button-clickable']")?.forEach(e => e.removeAttribute("onclick"));
    for (let emote of emotes) {
        clickEmoteSection(emote);
        await sleep(randomInteger(300, 600));
        let emoteButtonSelector = `button[data-test-selector="emote-button-clickable"]:has(img[src*="${emote.id}"])`;
        await waitForElementVisible(emoteButtonSelector, 5000, false)
        await sleep(randomInteger(300, 600))
        const emoteButton = document.querySelector(emoteButtonSelector);
        emoteButton.click();
        console.log(`[BetterTwitchLurk] Clicked Emote "${emote.token}"`);
        await sleep(randomInteger(300, 600));
    }
}

async function sendMessage(emoteCount) {
    let delay = Math.round(randomFloat(13, 15) * 60 * 1000);
    await waitForElementsVisible("[data-a-target='chat-input'] [data-a-target='emote-name']", emoteCount, 5000, false);
    document.querySelector("[data-a-target='chat-send-button']")?.click();
    try {
        await waitForElementVisible("[data-test-selector='chat-rules-ok-button']", 3000, true);
        document.querySelector("[data-test-selector='chat-rules-ok-button']")?.click()
        await sleep(randomInteger(300, 600))
    } catch {}
    let nextMessageAt = new Date(Date.now() + delay);
    await saveSetting(channel?.login, { lastMessage: new Date(), nextMessage: nextMessageAt }, "lastMessage");
    console.log(`[BetterTwitchLurk] Sent ${emoteCount} Emote${emoteCount>1?"s":""}`);
}

async function sendEmotes() {
    if (await getSetting("autoEmoteEnabled", false)) {
        if(emoteList && emoteList.length > 0) {
            let emoteCount = (await getSetting("useRange", false))?{ min: await getSetting("emoteMin", 1), max: await getSetting("emoteMax", 3) }:await getSetting("emoteCount", 1);
            let newCount = emoteCount;
            if (typeof emoteCount === "object" && !isNaN(emoteCount.min) && !isNaN(emoteCount.max)) {
                newCount = randomInteger(emoteCount.min, emoteCount.max);
            }
            console.log(`[BetterTwitchLurk] Selecting ${newCount} Emote${newCount>1?"s":""}`);
            if (document.querySelector("[data-a-target='chat-scroller']")) {
                if (isVisible(document.querySelector("div.emote-picker__tab-content"))) {
                    await selectEmotes(await getRandomEmotes(newCount));
                } else {
                    document.querySelector("[data-a-target='emote-picker-button']").click();
                    await waitForElementVisible("[data-a-target='emote-picker-button']", 5000, false);
                    await sleep(randomInteger(300, 600))
                    await selectEmotes(await getRandomEmotes(newCount));
                }
                await sendMessage(newCount);
            }
        }
    }
}

window.addEventListener("BetterTwitchLurk", async(event) => {
    if(event.detail.type === "EmotesUpdated") {
        console.log(`[BetterTwitchLurk] Updated List Of Emotes`);
        emoteList = event.detail.data.emoteList;
    } else if(event.detail.type === "ChannelName") {
        oldChannel = channel;
        channel = event.detail.data;
        if(channel?.login !== oldChannel?.login) console.log("[BetterTwitchLurk] Updated Channel Name:", channel?.login);
    } else if(event.detail.type === "ChannelLive") {
        const newStreamInfo = event.detail.data;
        if (!streamInfo || streamInfo.isLive !== newStreamInfo.isLive || streamInfo.user?.login !== newStreamInfo.user?.login) {
            console.log(`[BetterTwitchLurk] ${newStreamInfo.user.login} is ${newStreamInfo.isLive ? `Live and started stream at ${(new Date(newStreamInfo.startedAt)).toLocaleString().toUpperCase()}` : "Not Live"}`);
        }
        oldStreamInfo = streamInfo;
        streamInfo = newStreamInfo;
    } else if(event.detail.type === "MessageSent") {
        let sentAt = new Date(event.detail.data.sentAt);
        let nextMessageAt = new Date(sentAt.getTime() + Math.round(randomFloat(13, 15) * 60 * 1000))
        saveSetting(channel?.login, { lastMessage: sentAt, nextMessage: nextMessageAt }, "lastMessage");
        console.log("[BetterTwitchLurk] Updated Last Message Sent At:", sentAt.toLocaleString().toUpperCase());
    } else if(event.detail.type === "RaidingOut") {
        if(await getSetting("raidDisable", false) && await getSetting("autoEmoteEnabled", false)) {
            console.log(`[BetterTwitchLurk] Streamer Is Raiding Out Disabling Auto Emote`);
            await saveSetting("autoEmoteEnabled", false);
        }
    } else if(event.detail.type === "FollowingChannel") {
        isFollowing = event?.detail?.data?.isFollowing;
        if(event.detail.data.eventName === "FollowUser") {
            console.log(`[BetterTwitchLurk] You Followed ${event?.detail?.data?.user?.displayName||event?.detail?.data?.user?.login}`);
        } else if(event.detail.data.eventName === "UnfollowUser") {
            console.log(`[BetterTwitchLurk] You Unfollowed ${event?.detail?.data?.user?.displayName||event?.detail?.data?.user?.login}`);
        } else {
            console.log(`[BetterTwitchLurk] You ${isFollowing?"Are":"Are Not"} Following ${event?.detail?.data?.user?.displayName||event?.detail?.data?.user?.login}`);
        }
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "save") {
        saveSetting(msg.key, msg.value).then(() => sendResponse({ success: true }));
        return true;
    }

    if (msg.action === "get") {
        getSetting(msg.key, msg.defaultValue).then(value => sendResponse({ value }));
        return true;
    }

    if(msg.action === "open-emote-selector")  {
        if(!isVisible(document.querySelector("div.emote-picker__tab-content"))) document.querySelector("[data-a-target='emote-picker-button']")?.click();
        setTimeout(async() => emoteWhitelistMenu(), 500)
        alert("Click Emotes In The Emote Selector To Whitelist Them.");
        document.querySelector("[data-test-selector='emote-picker-close'], [data-a-target='emote-picker-button']").setAttribute("onclick", `
            document.querySelectorAll(".emote-picker__scroll-container [data-test-selector='emote-button-clickable']").forEach(e => e.removeAttribute("onclick"));
            this.removeAttribute('onclick');
        `);
    }
});

async function runAutoSendLoop() {    
    if (isSending) {
        return setTimeout(runAutoSendLoop, 1000);
    }

    isSending = true;
    try {
        const autoEnabled = await getSetting("autoEmoteEnabled", false);
        if (!autoEnabled || !channel?.login || !streamInfo?.isLive || (await getSetting("followedOnly", false) && !isFollowing)) {
            return;
        }

        const data = await getSetting(channel?.login, null, "lastMessage");
        const now = Date.now();
        const nextMsgTime = data?.nextMessage ? new Date(data.nextMessage).getTime() : now;

        if (!data || now >= nextMsgTime) {
            const delay = Math.round(randomFloat(13, 15) * 60 * 1000);
            let nextMessageAt =  new Date(now + delay);
            await saveSetting(channel?.login, { lastMessage: new Date(), nextMessage: nextMessageAt }, "lastMessage");
            await sendEmotes();
        }
    } catch (err) {
        console.error("[BetterTwitchLurk] runAutoSendLoop error:", err);
    } finally {
        isSending = false;
        setTimeout(runAutoSendLoop, 1000);
    }
}

runAutoSendLoop();

async function injectScripts(scriptFiles) {
    for (const file of scriptFiles) {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(file);
        (document.head || document.documentElement).appendChild(script);
    }
}

injectScripts(["fetchHook.js", "countdown.js"]);