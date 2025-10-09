(() => {
    let currentUser = {};
    let currentChannel;

    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        try {
            if (args[0]?.includes("gql.twitch.tv/gql")) {
                const data = await response.clone().json();

                for (const item of data) {
                    if (item?.extensions?.operationName === "AvailableEmotesForChannelPaginated") {
                        const emoteEdges = item?.data?.channel?.self?.availableEmoteSetsPaginated?.edges;
                        if (emoteEdges) {
                            const emotes = emoteEdges.map(edge => ({
                                owner: edge.node.owner,
                                emotes: edge.node.emotes.filter(e => e.type !== "BITS_BADGE_TIERS" && e.type !== "TWO_FACTOR")
                            })).filter(edge => edge.emotes.length);

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
                    
                    if (item?.extensions?.operationName === "UseLive") {
                        const user = item?.data?.user;
                        if (user) {
                            const stream = user.stream;
                            let userItem = {
                                id: user.id,
                                login: user.login
                            }
                            currentChannel = userItem;
                            window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                detail: {
                                    type: "ChannelName",
                                    data: userItem             
                                }
                            }));
                            if (stream) {
                                window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                    detail: {
                                        type: "ChannelLive",
                                        data: {
                                            user: userItem,
                                            isLive: true,
                                            streamId: stream.id,
                                            startedAt: stream.createdAt,
                                        }
                                    }
                                }));
                            } else {
                                window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                    detail: {
                                        type: "ChannelLive",
                                        data: {
                                            user: userItem,
                                            isLive: false
                                        }
                                    }
                                }));
                            }
                        }
                    }

                    if (item?.extensions?.operationName === "sendChatMessage") {
                        window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                            detail: {
                                type: "MessageSent",
                                data: {
                                    sentAt: Date.now()
                                }
                            }
                        }));
                    }

                    if (item?.data?.currentUser) {
                        const user = item?.data?.currentUser;
                        if (user?.id) {
                            currentUser.id = user.id;
                            if (user.login) currentUser.login = user.login;
                        }
                    }
                }
            }
        } catch {}
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
                    data.split('\r\n').forEach(line => {
                        if (!line.startsWith('@') || !line.includes('!') || !line.includes(':')) return;
                        const match = line.match(/@.*?user-id=(\d+).*?\sPRIVMSG\s#(\w+)\s:(.*)$/);
                        if (match) {
                            const [, userId, channel, message] = match;
                            if (channel === currentChannel?.login && userId === currentUser?.id) {
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
                } catch {}
            });
        }
    }
    
    window.WebSocket = HookedWebSocket;    
})();