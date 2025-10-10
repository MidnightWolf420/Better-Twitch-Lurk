(() => {
    window.addEventListener("load", () => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/countdown@2.6/countdown.min.js";
        script.onload = () => {
            let nextMessageAt = new Date();
            let showCountdown = true;
            let lastCountdownRequest = 0;

            window.addEventListener("message", (event) => {
                if (event.source !== window) return;
                const msg = event.data;
                if (msg?.eventName === "BetterTwitchLurkData") {
                    if (msg?.type === "nextMessageAt") {
                        if(msg.data?.nextMessage) nextMessageAt = msg.data?.nextMessage;
                    } else if (msg?.type === "isCountdownEnabled") {
                        showCountdown = msg.data;
                    }
                }
            });

            function getCountdownEnabled() {
                const now = Date.now();
                if (now - lastCountdownRequest < 1000) return;
                lastCountdownRequest = now;
                window.dispatchEvent(
                    new CustomEvent("BetterTwitchLurk", {
                        detail: {
                            type: "isCountdownEnabled"
                        }
                    })
                );
            }

            function updateCountdown() {
                const targetEl = document.querySelector('[aria-describedby="Exit-chat-container"]');
                if (!targetEl) {
                    setTimeout(updateCountdown, 600);
                    return;
                }

                getCountdownEnabled();
                let counterEl = document.getElementById("nextMessage");

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