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
    async loginUser(kuzzle, username, password) {
        try {
            await kuzzle.auth.login("local", {
                username,
                password,
            });
        }
        catch (error) {
            throw new Error(`KuzzleAuth login failed for user ${username}: ${error.message}`);
        }
    }
    async processCurrentUser(user) {
        try {
            if (!user) {
                throw new Error("No current user found");
            }
            if (!user._source) {
                throw new Error("No user source found");
            }
            if (!user._source.profileIds) {
                throw new Error("No profile IDs found for the user");
            }
            const profileIds = user._source.profileIds;
            if (!profileIds || profileIds.length === 0) {
                throw new Error("User has no profiles");
            }
            this.logger.info(`KuzzleAuth user ${user._id} has profiles: ${profileIds.join(", ")}`);
            if (!profileIds.includes("license-user")) {
                throw new Error(`User ${user._id} is not authorized with license-user profile`);
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    authenticate(user, password, cb) {
        const { url, port } = this.config;
        this.logger.info(`KuzzleAuth authenticate ${user}`);
        const kuzzle = new kuzzle_sdk_1.Kuzzle(new kuzzle_sdk_1.Http(url, { port }));
        kuzzle
            .connect()
            .then(() => {
            this.loginUser(kuzzle, user, password)
                .then(() => {
                return kuzzle.auth.getCurrentUser();
            })
                .then((currentUser) => {
                this.processCurrentUser(currentUser).then((isAuthorized) => {
                    if (isAuthorized) {
                        cb(null, ["$authenticated"]);
                    }
                    else {
                        cb(null, false);
                    }
                });
            })
                .catch((err) => {
                this.logger.error(`Authentication failed: ${err.message}`);
                cb(null, false);
            });
        })
            .catch((err) => {
            this.logger.error(err);
            cb(null, false);
        });
    }
}
exports.default = KuzzleAuth;
