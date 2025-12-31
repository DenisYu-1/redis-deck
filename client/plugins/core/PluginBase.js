export class PluginBase {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.priority = config.priority || 0;
        this.config = config.config || {};
    }

    async init() {
        throw new Error(`Plugin ${this.id} must implement init()`);
    }

    async destroy() {}
}
