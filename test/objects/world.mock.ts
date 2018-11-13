import { World } from "../../src/objects";
import { MockRedisConnection } from "../redis.mock";

type MonitorExpectFunc = (args: string[], raw?: string) => boolean;
type MonitorExpectation = string | MonitorExpectFunc;

export class MockWorld extends World {
    public get redis() {
        return this.opts.redisConnection;
    }

    private monitor: NodeJS.EventEmitter;
    private monitors: Map<symbol, (...args: any) => void> = new Map();

    constructor(protected opts: {
        redisConnection: MockRedisConnection
    }) {
        super(opts);
    }

    public async addMonitor(expected: MonitorExpectation) {
        if (!this.monitor) {
            this.monitor = await this.redis.client.monitor();
            if (!this.monitor) {
                throw new Error("Unable to start monitoring: " + this.monitor);
            }
        }

        const sym = Symbol();
        const p = new Promise<string[]>((resolve, reject) => {
            const listener = (time: string, args: string[]) => {
                const raw_reply = args.join(" ");
                // Logger.debug("Redis Monitor", { time, args, raw_reply });
                if (
                    (typeof expected === "string" && raw_reply.indexOf(expected) > -1) ||
                    (typeof expected === "function" && expected(args, raw_reply))
                ) {
                    // Logger.debug(`Matched [${expected}] for [${args}]`);
                    resolve(args);
                }
            };

            this.monitor.on("monitor", listener);
            this.monitors.set(sym, listener);
        });

        return { "marker": sym, "monitor": p };
    }

    public removeMonitor(idn: symbol): void {
        if (!this.monitors.has(idn)) {
            return;
        }

        const listener = this.monitors.get(idn);
        this.monitor.removeListener("monitor", listener);
        this.monitors.delete(idn);
    }
}
