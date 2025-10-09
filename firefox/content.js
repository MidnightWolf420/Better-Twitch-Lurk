let indexedDBStores = ["settings", "lastMessage"];
let dbName = "BetterTwitchLurkDB";
let lastEnabledState = null;
let emoteList = [];
let oldStreamInfo;
let streamInfo;
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

function getRandomEmotes(count = 1) {
    if (!emoteList?.length) return [];
    const allEmotes = emoteList.flatMap(set => set.emotes.map(emote => ({ ...emote, owner: set.owner })));

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

function waitForElementVisible(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkVisibility = () => {
            const el = document.querySelector(selector);
            if (el && el.offsetParent !== null) {
                resolve(el);
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Element not visible within timeout'));
            } else {
                requestAnimationFrame(checkVisibility);
            }
        };

        checkVisibility();
    });
}

function waitForElementsVisible(selector, count = 1, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkExistence = () => {
            const elements = document.querySelectorAll(selector);

            if (elements.length >= count) {
                resolve(elements);
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Expected ${count} elements, but found ${elements.length}`));
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
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
}

function clickEmoteSection(emote) {
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function selectEmotes(emotes) {
    for (let emote of emotes) {
        clickEmoteSection(emote);
        await sleep(randomInteger(300, 600));
        let emoteButtonSelector = `button[data-test-selector="emote-button-clickable"]:has(img[src*="${emote.id}"])`;
        waitForElementVisible(emoteButtonSelector).then(async() => {
            await sleep(randomInteger(300, 600))
            const emoteButton = document.querySelector(emoteButtonSelector);
            emoteButton.click();
            console.log(`[BetterTwitchLurk] Clicked Emote "${emote.token}"`);
        }).catch(err => {})
        await sleep(randomInteger(300, 600));
    }
}

function sendMessage(emoteCount, delay) {
    waitForElementsVisible("[data-a-target='chat-input'] [data-a-target='emote-name']", emoteCount).then(async() => {
        document.querySelector("[data-a-target='chat-send-button']")?.click();
        waitForElementVisible("[data-test-selector='chat-rules-ok-button']", 3000).then(async() => {
            document.querySelector("[data-test-selector='chat-rules-ok-button']")?.click()
            await sleep(randomInteger(300, 600))
            if(delay) {
                saveSetting(channel?.login, { lastMessage: new Date(), nextMessage: new Date(Date.now() + delay) }, "lastMessage")
            } else saveSetting(channel?.login, { lastMessage: new Date() }, "lastMessage")
            console.log(`[BetterTwitchLurk] Sent ${emoteCount} Emote${emoteCount>1?"s":""}`);
        }).catch(err => {
            if(delay) {
                saveSetting(channel?.login, { lastMessage: new Date(), nextMessage: new Date(Date.now() + delay) }, "lastMessage")
            } else saveSetting(channel?.login, { lastMessage: new Date() }, "lastMessage")
            console.log(`[BetterTwitchLurk] Sent ${emoteCount} Emote${emoteCount>1?"s":""}`);
        })
    }).catch(err => {})
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
                    await selectEmotes(getRandomEmotes(newCount));
                } else {
                    document.querySelector("[data-a-target='emote-picker-button']").click();
                    waitForElementVisible("[data-a-target='emote-picker-button']").then(async() => {
                        await sleep(randomInteger(300, 600))
                        selectEmotes(getRandomEmotes(newCount));
                    }).catch(err => {})
                }
                sendMessage(newCount, randomFloat(13, 15) * 60 * 1000);
            }
        }
    }
}

window.addEventListener("BetterTwitchLurk", (event) => {
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
        saveSetting(channel?.login, { lastMessage: sentAt, nextMessage: new Date(sentAt + (randomFloat(13, 15) * 60 * 1000)) }, "lastMessage")
        console.log("[BetterTwitchLurk] Updated Last Message Sent At:", sentAt.toLocaleString().toUpperCase());
    }
});

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "save") {
        saveSetting(msg.key, msg.value).then(() => sendResponse({ success: true }));
        return true;
    }
    if (msg.action === "get") {
        getSetting(msg.key, msg.defaultValue).then(value => sendResponse({ value }));
        return true;
    }
    if(msg.action === "send-emotes") {
        sendEmotes();
        return true;
    }
});

setInterval(async () => {
    if (await getSetting("autoEmoteEnabled", false)) {
        if (channel?.login) {
            if(streamInfo?.isLive) {
                const data = await getSetting(channel?.login, null, "lastMessage");
                const recentlyPosted = data?.lastMessage && (Date.now() - data.lastMessage < 60 * 1000);
                if (!recentlyPosted && (!data || !data.nextMessage || Date.now() >= data.nextMessage)) {
                    sendEmotes();
                }
            }
        }
    }
}, 5000);

function injectFetchHook() {
    const script = document.createElement('script');
    script.src = (typeof browser !== "undefined" ? browser.runtime.getURL('fetchHook.js') : chrome.runtime.getURL('fetchHook.js'));
    (document.head || document.documentElement).appendChild(script);
}


injectFetchHook()