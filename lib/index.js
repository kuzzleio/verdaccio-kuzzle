"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kuzzle_sdk_1 = require("kuzzle-sdk");
class KuzzleAuth {
    logger;
    config;
    constructor(config, { logger }) {
        this.logger = logger;
        this.config = config;
        this.logger.info(`KuzzleAuth initialized with config ${JSON.stringify(config)}`);
    }
    authenticate(user, password, cb) {
        const { url, port } = this.config;
        this.logger.info(`KuzzleAuth authenticate ${user}`);
        const kuzzle = new kuzzle_sdk_1.Kuzzle(new kuzzle_sdk_1.WebSocket(url, { port }));
        kuzzle
            .connect()
            .then(() => {
            this.logger.info(`KuzzleAuth connected to ${url}:${port}`);
            kuzzle.auth
                .login("local", { username: user, password })
                .then((response) => {
                this.logger.info(`KuzzleAuth login success for ${user} with reponse ${JSON.stringify(response)}`);
                cb(null, ["$authenticated"]);
            })
                .catch((err) => {
                this.logger.error(err);
                cb(null, false);
            })
                .finally(() => {
                kuzzle.disconnect();
            });
        })
            .catch((err) => {
            this.logger.error(err);
            kuzzle.disconnect();
            cb(null, false);
        });
    }
}
exports.default = KuzzleAuth;
