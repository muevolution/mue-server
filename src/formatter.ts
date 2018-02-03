import * as _ from "lodash";
import * as formatter from "string-format";

import { MessageFormats } from "../client_types";
import { World } from "./objects";

function safeArgs(args: {[key: string]: any}) {
    return _.mapValues(args, (value, key) => {
        if (typeof value === "string" || typeof value === "number") {
            return value;
        }
        return JSON.stringify(value);
    });
}

export interface FormattedMessage {
    message: string;
    substitutions: {[key: string]: string};
}

export async function format(world: World, msg: string, args: {[key: string]: any}): Promise<FormattedMessage> {
    const namesToSubstitute: string[] = [];

    const transformers = {
        "name": (str: string) => {
            namesToSubstitute.push(str);
            return `{__hyper_name_${str}}`;
        }
    };

    args = safeArgs(args);
    const f = formatter.create(transformers);
    let message = msg ? f(msg, args) : null;
    if (!message) {
        return {"message": null, "substitutions": null};
    }

    const substitutions: FormattedMessage["substitutions"] = {};
    await Promise.all(_.map(namesToSubstitute, async (id) => {
        const obj = await world.getObjectById(id);
        if (!obj) {
            return undefined;
        }

        substitutions[`__hyper_name_${id}`] = obj.name;
    }));

    message = f(message, substitutions);

    return { message, substitutions };
}
