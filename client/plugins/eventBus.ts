import type { PluginEvent, PluginEventType, PluginEventHandler } from './types';

class EventBus {
    private handlers = new Map<PluginEventType, Set<PluginEventHandler>>();

    // Subscribe to an event type
    on(eventType: PluginEventType, handler: PluginEventHandler): () => void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }

        this.handlers.get(eventType)!.add(handler);

        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(eventType);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.handlers.delete(eventType);
                }
            }
        };
    }

    // Emit an event to all subscribers
    emit(event: PluginEvent): void {
        const handlers = this.handlers.get(event.type);
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(event);
                } catch (error) {
                    console.error(
                        `Error in event handler for ${event.type}:`,
                        error
                    );
                }
            });
        }
    }

    // Get all event types that have subscribers
    getSubscribedEvents(): PluginEventType[] {
        return Array.from(this.handlers.keys());
    }

    // Clear all handlers (useful for cleanup)
    clear(): void {
        this.handlers.clear();
    }

    // Get handler count for debugging
    getHandlerCount(eventType?: PluginEventType): number {
        if (eventType) {
            return this.handlers.get(eventType)?.size ?? 0;
        }
        return Array.from(this.handlers.values()).reduce(
            (total, handlers) => total + handlers.size,
            0
        );
    }
}

// Singleton instance
export const eventBus = new EventBus();
