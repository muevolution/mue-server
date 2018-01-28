declare namespace StringFormat {
    interface StringFormatStatic {
        (str: string, ...args: (object | string)[]): string;
        create(transformers: {[key: string]: (str: string) => string}): StringFormatStatic;
        extend(obj: object): void;
    }
}

declare const aa: StringFormat.StringFormatStatic;

export = aa;
