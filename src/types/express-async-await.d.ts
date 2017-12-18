import * as express from "express";

declare namespace ExpressAsyncAwait {
    interface ExpressAsyncAwaitStatic {
        (ex: express.Express): express.Express;
        (ex: express.Router): express.Router;
    }
}

declare const aa: ExpressAsyncAwait.ExpressAsyncAwaitStatic;

export = aa;