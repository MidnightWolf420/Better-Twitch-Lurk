async function saveSetting(key, value) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    await browser.tabs.sendMessage(tab.id, { action: "save", key, value });
}

async function getSetting(key, defaultValue = null) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) return defaultValue;
    try {
        const response = await browser.tabs.sendMessage(tab.id, { action: "get", key, defaultValue });
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

    const autoEmoteEnabled = await getSetting("autoEmoteEnabled", false);
    const showCountdown = await getSetting("showCountdown", false);
    const raidDisable = await getSetting("raidDisable", false);
    const followedOnly = await getSetting("followedOnly", false);
    const useRange = await getSetting("useRange", false);

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
});

browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;
    if (!url.match(/^https:\/\/(www\.)?twitch\.tv\//)) {
        document.body.innerHTML = "<p>This extension only works on Twitch.</p>";
    }
});