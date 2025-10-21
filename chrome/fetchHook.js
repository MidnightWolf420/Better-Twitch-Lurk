(() => {
    let currentUser = {};
    let currentChannel;
    let isAdPlaying;
    let adStartTime;

    function isDate(value) {
        return value instanceof Date && !isNaN(value.getTime());
    }

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
        const [url, options] = args;
        const requestBody = options?.body;
        const response = await originalFetch(...args);
        try {
            if (url?.includes("gql.twitch.tv/gql")) {
                const data = await response.clone().json();
                const items = Array.isArray(data) ? data : [data];

                const currentUserItem = items.find(item => item?.data?.currentUser);
                if (currentUserItem) {
                    const user = currentUserItem.data.currentUser;
                    if (user?.id) currentUser.id = user.id;
                    if (user?.login) currentUser.login = user.login;
                    window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                        detail: {
                            type: "CurrentUser",
                            data: currentUser
                        }
                    }));
                }

                const emoteItem = items.find(item => item?.extensions?.operationName === "AvailableEmotesForChannelPaginated");
                if (emoteItem) {
                    const emoteEdges = emoteItem?.data?.channel?.self?.availableEmoteSetsPaginated?.edges;
                    if (emoteEdges) {
                        const emotes = emoteEdges.map(edge => ({
                            owner: edge.node.owner,
                            emotes: edge.node.emotes.filter(e => e.type !== "BITS_BADGE_TIERS")
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

                const adItem = items.find(item => item?.extensions?.operationName === "ClientSideAdEventHandling_RecordAdEvent");
                if (adItem) {
                    try {
                        let adRequestItem = JSON.parse(requestBody).find(item => item?.operationName === "ClientSideAdEventHandling_RecordAdEvent");
                        if(adRequestItem) {
                            let eventName = adRequestItem.variables.input.eventName;
                            let adPayload = JSON.parse(adRequestItem.variables.input.eventPayload);
                            isAdPlaying = eventName != "video_ad_pod_complete";
                            if(isAdPlaying) {
                                if(!adStartTime || !isDate(adStartTime)) adStartTime = new Date()
                            } else adStartTime = null;

                            window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                detail: {
                                    type: "AdPlaying",
                                    data: {
                                        eventName: eventName,
                                        rollType: adPayload.roll_type,
                                        adPostition: adPayload.ad_position,
                                        duration: adPayload.duration,
                                        isAdPlaying: isAdPlaying,
                                        ...(adStartTime != null && { startedAt: adStartTime })
                                    }
                                }
                            }));
                        }
                    } catch {}
                }

                const followItem = items.find(item => item?.extensions?.operationName === "FollowButton_User" || item?.extensions?.operationName === "FollowButton_FollowUser" || item?.extensions?.operationName === "FollowButton_UnfollowUser");
                if (followItem) {
                    if(followItem?.extensions?.operationName === "FollowButton_User") {
                        let channel = {
                            id: followItem.data?.user?.id,
                            displayName: followItem.data?.user?.displayName,
                            login: followItem.data?.user?.login
                        }

                        if(channel.id === currentChannel.id) {
                            let isFollowing = followItem.data?.user?.self?.follower && followItem.data?.user?.self?.follower?.followedAt;
                            window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                detail: {
                                    type: "FollowingChannel",
                                    data: {
                                        eventName: "IsFollowing",
                                        user: channel,
                                        follower: followItem.data?.user?.self?.follower,
                                        isFollowing
                                    }
                                }
                            }));
                        }
                    } else if(followItem?.extensions?.operationName === "FollowButton_FollowUser") {
                        let channel = {
                            id: followItem.data?.followUser?.follow?.user?.id,
                            displayName: followItem.data?.followUser?.follow?.user?.displayName,
                            login: followItem.data?.followUser?.follow?.user?.login
                        }

                        if(channel.id === currentChannel.id) {
                            let isFollowing = followItem.data?.followUser?.follow?.user?.self?.follower && followItem.data?.followUser?.follow?.user?.self?.follower?.followedAt;
                            window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                detail: {
                                    type: "FollowingChannel",
                                    data: {
                                        eventName: "FollowUser",
                                        user: channel,
                                        follower: followItem.data?.followUser?.follow?.user?.self?.follower,
                                        isFollowing
                                    }
                                }
                            }));
                        }
                    } else if(followItem?.extensions?.operationName === "FollowButton_UnfollowUser") {
                        let channel = {
                            id: followItem.data?.unfollowUser?.follow?.user?.id,
                            displayName: followItem.data?.unfollowUser?.follow?.user?.displayName,
                            login: followItem.data?.unfollowUser?.follow?.user?.login
                        }

                        if(channel.id === currentChannel.id) {
                            let isFollowing = false;
                            window.dispatchEvent(new CustomEvent("BetterTwitchLurk", {
                                detail: {
                                    type: "FollowingChannel",
                                    data: {
                                        eventName: "UnfollowUser",
                                        user: channel,
                                        follower: null,
                                        isFollowing
                                    }
                                }
                            }));
                        }
                    }
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