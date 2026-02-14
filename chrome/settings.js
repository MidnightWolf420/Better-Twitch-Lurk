async function saveSetting(key, value) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    await chrome.tabs.sendMessage(tab.id, { action: "save", key, value });
}

async function getSetting(key, defaultValue = null) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return defaultValue;
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "get", key, defaultValue });
        return response?.value ?? defaultValue;
    } catch {
        return defaultValue;
    }
}

function setToggleState(element, state) {
    if (element) {
        if (state) {
            element.classList.add("active");
            element.setAttribute("aria-pressed", "true");
        } else {
            element.classList.remove("active");
            element.setAttribute("aria-pressed", "false");
        }
    }
}

function showContainer(container) {
    container.classList.remove("hidden");
    container.classList.add("visible");
}

function hideContainer(container) {
    container.classList.remove("visible");
    container.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", async () => {

    const autoEmoteBtn = document.querySelector("#auto-emote-btn");
    const raidDisableBtn = document.querySelector("#raid-disable-btn");
    const followedOnlyBtn = document.querySelector("#followed-only-btn");
    const showCountdownBtn = document.querySelector("#show-countdown-btn");
    const useRangeBtn = document.querySelector("#use-range-btn");
    const emoteCountRow = document.querySelector("#emote-count-row");
    const emoteMinRow = document.querySelector("#emote-min-row");
    const emoteMaxRow = document.querySelector("#emote-max-row");
    const emoteCountInput = document.querySelector("#emote-count");
    const emoteMinInput = document.querySelector("#emote-min");
    const emoteMaxInput = document.querySelector("#emote-max");
    const customMessageInput = document.querySelector("#custom-message");
    const emoteWhitelistInput = document.querySelector("#emote-whitelist");
    const addEmotesBtn = document.querySelector("#add-emotes");
    const removeWhitelistedEmotesBtn = document.querySelector("#remove-all-emotes");

    const autoEmoteEnabled = await getSetting("autoEmoteEnabled", false);
    const showCountdown = await getSetting("showCountdown", false);
    const raidDisable = await getSetting("raidDisable", false);
    const followedOnly = await getSetting("followedOnly", false);
    const useRange = await getSetting("useRange", false);
    let whitelistedEmotes = new Map(Object.entries(await getSetting("whitelistedEmotes", {})));

    setToggleState(autoEmoteBtn, autoEmoteEnabled);
    setToggleState(raidDisableBtn, raidDisable);
    setToggleState(followedOnlyBtn, followedOnly);
    setToggleState(showCountdownBtn, showCountdown);
    setToggleState(useRangeBtn, useRange);

    if (useRange) {
        hideContainer(emoteCountRow);
        showContainer(emoteMinRow);
        showContainer(emoteMaxRow);
    } else {
        showContainer(emoteCountRow);
        hideContainer(emoteMinRow);
        hideContainer(emoteMaxRow);
    }

    emoteCountInput.value = await getSetting("emoteCount", 1);
    emoteMinInput.value = await getSetting("emoteMin", 1);
    emoteMaxInput.value = await getSetting("emoteMax", 3);
    customMessageInput.value = await getSetting("customMessage", "");

    autoEmoteBtn.addEventListener("click", async () => {
        const newState = autoEmoteBtn.getAttribute("aria-pressed") !== "true";
        setToggleState(autoEmoteBtn, newState);
        await saveSetting("autoEmoteEnabled", newState);
    });

    raidDisableBtn.addEventListener("click", async () => {
        const newState = raidDisableBtn.getAttribute("aria-pressed") !== "true";
        setToggleState(raidDisableBtn, newState);
        await saveSetting("raidDisable", newState);
    });

    followedOnlyBtn.addEventListener("click", async () => {
        const newState = followedOnlyBtn.getAttribute("aria-pressed") !== "true";
        setToggleState(followedOnlyBtn, newState);
        await saveSetting("followedOnly", newState);
    });

    showCountdownBtn.addEventListener("click", async () => {
        const newState = showCountdownBtn.getAttribute("aria-pressed") !== "true";
        setToggleState(showCountdownBtn, newState);
        await saveSetting("showCountdown", newState);
    });

    useRangeBtn.addEventListener("click", async () => {
        const newState = useRangeBtn.getAttribute("aria-pressed") !== "true";
        setToggleState(useRangeBtn, newState);

        if (newState) {
            hideContainer(emoteCountRow);
            showContainer(emoteMinRow);
            showContainer(emoteMaxRow);
        } else {
            showContainer(emoteCountRow);
            hideContainer(emoteMinRow);
            hideContainer(emoteMaxRow);
        }
        

        await saveSetting("useRange", newState);
    });

    emoteCountInput.addEventListener("change", async () => {
        await saveSetting("emoteCount", parseInt(emoteCountInput.value) || 1);
    });

    emoteMinInput.addEventListener("change", async () => {
        await saveSetting("emoteMin", parseInt(emoteMinInput.value) || 1);
    });

    emoteMaxInput.addEventListener("change", async () => {
        await saveSetting("emoteMax", parseInt(emoteMaxInput.value) || 3);
    });

    customMessageInput.addEventListener("change", async () => {
        await saveSetting("customMessage", customMessageInput.value || "");
    });

    removeWhitelistedEmotesBtn.addEventListener("click", async () => {
        removeAllEmotes();
    });

    addEmotesBtn.addEventListener("click", async (event) => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        await chrome.tabs.sendMessage(tab.id, { action: "open-emote-selector" });
    });

    function renderWhitelistedEmotes() {
        emoteWhitelistInput.querySelectorAll(".emote-chip").forEach(chip => chip.remove());
    
        whitelistedEmotes.forEach((emote, id) => {
            const chip = document.createElement("div");
            chip.className = "emote-chip";
    
            const img = document.createElement("img");
            img.src = `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/light/1.0`;
            img.alt = emote.token;
            img.setAttribute('aria-label', emote.token);
    
            const btn = document.createElement("button");
            btn.className = "remove-btn";
    
            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("xmlns", svgNS);
            svg.setAttribute("width", "16");
            svg.setAttribute("height", "16");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "none");
            svg.setAttribute("stroke", "currentColor");
            svg.setAttribute("stroke-width", "2");
            svg.setAttribute("stroke-linecap", "round");
            svg.setAttribute("stroke-linejoin", "round");
    
            const path1 = document.createElementNS(svgNS, "path");
            path1.setAttribute("d", "M18 6 6 18");
            const path2 = document.createElementNS(svgNS, "path");
            path2.setAttribute("d", "m6 6 12 12");
    
            svg.appendChild(path1);
            svg.appendChild(path2);
    
            btn.appendChild(svg);
            btn.addEventListener("click", () => removeEmote(id));
    
            chip.appendChild(img);
            chip.appendChild(btn);
            emoteWhitelistInput.appendChild(chip);
        });
    
        emoteWhitelistInput.style.minHeight = whitelistedEmotes.size === 0 ? 'calc(28px + 8px)' : '';
    }
    
    function removeEmote(id) {
        whitelistedEmotes.delete(id);
        saveSetting("whitelistedEmotes", Object.fromEntries(whitelistedEmotes))
        renderWhitelistedEmotes();
    }
    
    function removeAllEmotes() {
        whitelistedEmotes.clear();
        saveSetting("whitelistedEmotes", {})
        renderWhitelistedEmotes();
    }

    renderWhitelistedEmotes();

    setInterval(async() => {
        whitelistedEmotes = new Map(Object.entries(await getSetting("whitelistedEmotes", {})));
    }, 3000)
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;
    if (!url.match(/^https:\/\/(www\.)?twitch\.tv\//)) {
        document.body.innerHTML = "<p>This extension only works on Twitch.</p>";
    }
});