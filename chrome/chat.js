let chatInputSelector = "textarea[data-a-target=\"chat-input\"], div[data-a-target=\"chat-input\"]";

function getReactInstance(element) {
    for (const key in element) {
        if (key.startsWith("__reactInternalInstance$") || key.startsWith("__reactFiber$")) {
            return element[key];
        }
    }
    return null;
}

function searchReactParents(node, predicate, maxDepth = 15, depth = 0) {
    try {
        if (predicate(node)) return node;
    } catch {}

    if (!node || depth > maxDepth) return null;

    const { return: parent } = node;
    if (parent) return searchReactParents(parent, predicate, maxDepth, depth + 1);

    return null;
}

function getChatInput(element = null) {
    let chatInput;
    try {
        chatInput = searchReactParents(getReactInstance(element || document.querySelector(chatInputSelector)), (n) => n.memoizedProps && n.memoizedProps.componentType != null && n.memoizedProps.value != null);
    } catch {}
    return chatInput;
}

function getChatInputValue() {
    const element = document.querySelector(chatInputSelector);

    const { value: currentValue } = element;
    if (currentValue != null) return currentValue;

    const chatInput = getChatInput(element);
    if (!chatInput) return "";

    return chatInput.memoizedProps.value;
}

function setChatInputValue(text, shouldFocus = true) {
    const element = document.querySelector(chatInputSelector);

    const { value: currentValue, selectionStart } = element;
    if (currentValue != null) {
        element.value = text;
        element.dispatchEvent(new Event("input", { bubbles: true }));

        const instance = getReactInstance(element);
        if (instance?.memoizedProps?.onChange) {
            instance.memoizedProps.onChange({ target: element });
        }

        const selectionEnd = selectionStart + text.length;
        element.setSelectionRange(selectionEnd, selectionEnd);

        if (shouldFocus) element.focus();
        return;
    }

    const chatInput = getChatInput(element);
    if (!chatInput) return;

    chatInput.memoizedProps.value = text;
    chatInput.memoizedProps.setInputValue(text);
    chatInput.memoizedProps.onValueUpdate(text);

    if (shouldFocus) {
        if (chatInput.memoizedProps.value?.editor?.setSelectionRange) {
            chatInput.memoizedProps.value.editor.focus();
            chatInput.memoizedProps.value.editor.setSelectionRange(text.length);
        } else {
            element.focus();
        }
    }
}

window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type === "setChatInputValue") {
        setChatInputValue(event.data.text);
    }
});