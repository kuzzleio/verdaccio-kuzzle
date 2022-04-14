"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kuzzle_sdk_1 = require("kuzzle-sdk");
class KuzzleAuth {
    logger;
    config;
    constructor(config, logger) {
        this.logger = logger;
        this.config = config;
        this.logger.info(`KuzzleAuth initialized with config ${JSON.stringify(config)}`);
    }
    authenticate(user, password, cb) {
        this.logger.info(`KuzzleAuth authenticate ${user}`);
        const { url } = this.config;
        const kuzzle = new kuzzle_sdk_1.Kuzzle(new kuzzle_sdk_1.WebSocket(url));
        kuzzle
            .login("local", { username: user, password })
            .then(() => {
            const groups = [];
            cb(null, groups);
        })
            .catch((err) => {
            this.logger.error(err);
            cb(null, false);
        })
            .finally(() => {
            kuzzle.disconnect();
        });
    }
}
exports.default = KuzzleAuth;
