export const linear = t => t;
export const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// The engine supplies elapsed visible time. This class never owns a timer/RAF.
export class TweenGroup {
    constructor() {
        this.items = new Set();
    }

    add(durationMs, onUpdate, easing = easeInOutCubic) {
        const duration = Math.max(0, Number(durationMs) || 0);
        return new Promise((resolve, reject) => {
            const item = { duration, elapsed: 0, onUpdate, easing, resolve, reject };
            try {
                onUpdate(duration === 0 ? 1 : 0);
                if (duration === 0) resolve(true);
                else this.items.add(item);
            } catch (error) { reject(error); }
        });
    }

    update(deltaMs) {
        for (const item of [...this.items]) {
            // An update can cancel the group or enqueue a new tween safely.
            if (!this.items.has(item)) continue;
            item.elapsed = Math.min(item.duration, item.elapsed + Math.max(0, deltaMs));
            try {
                item.onUpdate(item.easing(item.elapsed / item.duration));
                if (item.elapsed >= item.duration) {
                    this.items.delete(item);
                    item.resolve(true);
                }
            } catch (error) {
                this.items.delete(item);
                item.reject(error);
            }
        }
        return this.items.size > 0;
    }

    finish() {
        for (const item of [...this.items]) {
            if (!this.items.delete(item)) continue;
            try { item.onUpdate(1); item.resolve(true); }
            catch (error) { item.reject(error); }
        }
    }

    cancel() {
        for (const item of this.items) item.resolve(false);
        this.items.clear();
    }

    get active() { return this.items.size > 0; }
}
