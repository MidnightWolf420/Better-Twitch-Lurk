async function saveSetting(key, value) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "save", key, value }, (response) => {
            if (chrome.runtime.lastError || !response) resolve();
            else resolve();
        });
    });
}

async function getSetting(key, defaultValue = null) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return defaultValue;

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "get", key, defaultValue }, (response) => {
            if (chrome.runtime.lastError || !response) resolve(defaultValue);
            else resolve(response.value ?? defaultValue);
        });
    });
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

document.addEventListener("DOMContentLoaded", async () => {
    const autoEmoteBtn = document.querySelector("#auto-emote-btn");
    const useRangeCheckbox = document.querySelector("#use-range");
    const singleCountContainer = document.querySelector("#single-count-container");
    const rangeCountContainer = document.querySelector("#range-count-container");
    const emoteCountInput = document.querySelector("#emote-count");
    const emoteMinInput = document.querySelector("#emote-min");
    const emoteMaxInput = document.querySelector("#emote-max");

    const autoEmoteEnabled = await getSetting("autoEmoteEnabled", false);
    setToggleState(autoEmoteBtn, autoEmoteEnabled);
    const useRange = await getSetting("useRange", false);
    useRangeCheckbox.checked = useRange;
    singleCountContainer.style.display = useRange ? "none" : "block";
    rangeCountContainer.style.display = useRange ? "block" : "none";

    emoteCountInput.value = await getSetting("emoteCount", 1);
    emoteMinInput.value = await getSetting("emoteMin", 1);
    emoteMaxInput.value = await getSetting("emoteMax", 3);

    autoEmoteBtn.addEventListener("click", async () => {
        const currentState = autoEmoteBtn.getAttribute("aria-pressed") === "true";
        const newState = !currentState;
        setToggleState(autoEmoteBtn, newState);
        await saveSetting("autoEmoteEnabled", newState);
    });

    useRangeCheckbox.addEventListener("change", async () => {
        const checked = useRangeCheckbox.checked;
        singleCountContainer.style.display = checked ? "none" : "block";
        rangeCountContainer.style.display = checked ? "block" : "none";
        await saveSetting("useRange", checked);
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

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;
    if (!url.match(/^https:\/\/(www\.)?twitch\.tv\//)) {
        document.body.innerHTML = "<p>This extension only works on Twitch.</p>";
    }
});