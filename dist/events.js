export function createEventBus() {
    const listeners = {};
    return {
        emit(event, payload) {
            const handlers = listeners[event];
            if (handlers) {
                for (const handler of Array.from(handlers)) {
                    handler(payload);
                }
            }
        },
        on(event, handler) {
            if (!listeners[event]) {
                listeners[event] = new Set();
            }
            listeners[event].add(handler);
        },
        off(event, handler) {
            const handlers = listeners[event];
            if (handlers) {
                handlers.delete(handler);
            }
        },
    };
}
