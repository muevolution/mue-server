import * as _ from "lodash";
import * as formatter from "string-format";

import { MessageFormats } from "../client_types";

function safeArgs(args: {[key: string]: any}) {
    return _.mapValues(args, (value, key) => {
        if (typeof value === "string" || typeof value === "number") {
            return value;
        }
        return JSON.stringify(value);
    });
}

export function format(msgs: MessageFormats, args: {[key: string]: any}): MessageFormats {
    const transformers = {
        "lower": (str: string) => str.toLowerCase()
    };

    args = safeArgs(args);
    const f = formatter.create(transformers);

    const firstPerson = msgs.firstPerson ? f(msgs.firstPerson, args) : null;
    const thirdPerson = msgs.thirdPerson ? f(msgs.thirdPerson, args) : null;

    return { firstPerson, thirdPerson };
}
