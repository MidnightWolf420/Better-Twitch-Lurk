(() => {
    let currentUser = {};
    let currentChannel;

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
            if (args[0]?.includes("gql.twitch.tv/gql")) {
                const data = await response.clone().json();
                const items = Array.isArray(data) ? data : [data];

                const currentUserItem = items.find(item => item?.data?.currentUser);
                if (currentUserItem) {
                    const user = currentUserItem.data.currentUser;
                    if (user?.id) currentUser.id = user.id;
                    if (user?.login) currentUser.login = user.login;
                }

                const emoteItem = items.find(item => item?.extensions?.operationName === "AvailableEmotesForChannelPaginated");
                if (emoteItem) {
                    const emoteEdges = emoteItem?.data?.channel?.self?.availableEmoteSetsPaginated?.edges;
                    if (emoteEdges) {
                        const emotes = emoteEdges
                            .map(edge => ({
                                owner: edge.node.owner,
                                emotes: edge.node.emotes.filter(e => e.type !== "BITS_BADGE_TIERS" && e.type !== "TWO_FACTOR")
                            }))
                            .filter(edge => edge.emotes.length);

                        window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                            detail: {
                                type: "EmotesUpdated",
                                data: {
                                    emoteList: emotes
                                }
                            }
                        }));
                    }
                }

                const useLiveItem = items.find(item => item?.extensions?.operationName === "UseLive");
                if (useLiveItem) {
                    const user = useLiveItem?.data?.user;
                    if (user) {
                        const stream = user.stream;
                        const userItem = { id: user.id, login: user.login };
                        currentChannel = userItem;
                        window.currentChannel = currentChannel;

                        window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                            detail: {
                                type: "ChannelName",
                                data: userItem
                            }
                        }));

                        window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                            detail: {
                                type: "ChannelLive",
                                data: {
                                    user: userItem,
                                    isLive: !!stream,
                                    streamId: stream?.id,
                                    startedAt: stream?.createdAt
                                }
                            }
                        }));
                    }
                }

                const messageItem = items.find(item => item?.extensions?.operationName === "sendChatMessage");
                if (messageItem) {
                    console.log("[BetterTwitchLurk] Message Sent Post Request");
                    window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                        detail: {
                            type: "MessageSent",
                            data: {
                                sentAt: Date.now()
                            }
                        }
                    }));
                }
            }
        } catch { }
        return response;
    };

    const OriginalWebSocket = window.WebSocket;

    class HookedWebSocket extends OriginalWebSocket {
        constructor(url, protocols) {
            super(url, protocols);

            this.addEventListener('message', (event) => {
                try {
                    const data = event.data;
                    if (typeof data !== 'string') return;
                    if (this.url.startsWith('wss://irc-ws.chat.twitch.tv/')) {
                        data.split('\r\n').forEach(line => {
                            if (!line.startsWith('@') || !line.includes('!') || !line.includes(':')) return;
                            const match = line.match(/@.*?user-id=(\d+).*?\sPRIVMSG\s#(\w+)\s:(.*)$/);
                            if (match) {
                                const [, userId, channel, message] = match;
                                if (channel === currentChannel?.login && userId === currentUser?.id) {
                                    console.log("[BetterTwitchLurk] Message Sent Websocket")
                                    window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                        detail: {
                                            type: "MessageSent",
                                            data: {
                                                sentAt: Date.now()
                                            }
                                        }
                                    }));
                                }
                            }
                        });

                    } else if (this.url.startsWith('wss://hermes.twitch.tv/v1')) {
                        let parsed;
                        try {
                            parsed = JSON.parse(data);
                        } catch { return; }

                        if (parsed?.notification?.pubsub) {
                            let pubsub;
                            try {
                                pubsub = JSON.parse(parsed.notification.pubsub);
                            } catch { return; }

                            if (pubsub?.type === "raid_go_v2" && pubsub?.raid?.id) {
                                window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                    detail: {
                                        type: "RaidingOut",
                                        data: {
                                            raidId: pubsub.raid.id,
                                            creatorId: pubsub.raid.creator_id,
                                            targetId: pubsub.raid.target_id,
                                            targetLogin: pubsub.raid.target_login,
                                            viewerCount: pubsub.raid.viewer_count,
                                            receivedAt: Date.now()
                                        }
                                    }
                                }));
                            }
                        }
                    }
                } catch { }
            });
        }
    }

    window.WebSocket = HookedWebSocket;
})();