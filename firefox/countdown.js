let indexedDBStores = ["settings", "lastMessage"];
let dbName = "BetterTwitchLurkDB";

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

(async() => {
    window.addEventListener("load", async() => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/countdown@2.6/countdown.min.js";
        script.onload = async() => {
            let nextMessageAt = new Date();

            async function updateCountdown() {
                const targetEl = document.querySelector('[aria-describedby="Exit-chat-container"]');
                if (!targetEl) {
                    setTimeout(updateCountdown, 600);
                    return;
                }

                let counterEl = document.getElementById("nextMessage");
                let showCountdown = await getSetting("showCountdown", false);
                nextMessageAt = (await getSetting(window.currentChannel?.login, null, "lastMessage"))?.nextMessage;
                if (showCountdown) {
                    if (!counterEl) {
                        counterEl = document.createElement("div");
                        counterEl.style.cssText = "text-align: center; width: 100%;";
                        counterEl.id = "nextMessage";
                        targetEl.insertAdjacentElement("afterend", counterEl);
                    }

                    if (window.countdown) {
                        const ts = countdown(nextMessageAt, null, countdown.HOURS | countdown.MINUTES | countdown.SECONDS);
                        counterEl.textContent = "";
                        const strong = document.createElement("strong");
                        strong.style.cssText = "font-size: 1.2rem; max-width: 80%; white-space: nowrap; display: inline-block;";
                        if (ts.value >= 0) {
                            strong.textContent = "Next Message: 0 Second";
                        } else {
                            strong.textContent = "Next Message: " + ts.toString();
                        }

                        counterEl.appendChild(strong);
                    }
                } else if (!showCountdown && counterEl) {
                    counterEl.remove();
                    counterEl = null;
                }

                setTimeout(updateCountdown, 600);
            }


            updateCountdown();
        }
        document.head.appendChild(script);
    })
})();