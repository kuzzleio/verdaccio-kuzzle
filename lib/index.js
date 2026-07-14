"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kuzzle_sdk_1 = require("kuzzle-sdk");
const API_KEY_PREFIX = "kapikey-";
const AUTHENTICATED_GROUP = "$authenticated";
const DEPRECATED_GROUP = "legacy-deprecated";
const DEFAULT_DEPRECATION_NOTICE = "[DEPRECATED] Kuzzle username/password registry authentication is being " +
    "retired. Create a scoped API key in the PaaS console (project > API keys) " +
    "and use it as your npm password instead.";
class KuzzleAuth {
    logger;
    config;
    constructor(config, { logger }) {
        this.logger = logger;
        this.config = config;
        this.logger.info(`KuzzleAuth initialized with config ${JSON.stringify(config)}`);
    }
    newClient() {
        const { url, port } = this.config;
        return new kuzzle_sdk_1.Kuzzle(new kuzzle_sdk_1.Http(url, { port }));
    }
    async authenticateApiKey(token) {
        const kuzzle = this.newClient();
        try {
            await kuzzle.connect();
            kuzzle.jwt = token;
            const response = await kuzzle.query({
                controller: "registry",
                action: "resolveAccess",
            });
            const decision = response.result;
            if (decision && decision.authorized) {
                this.logger.info(`KuzzleAuth[apikey] authorized identity=${decision.identityId} ` +
                    `org=${decision.organizationId} project=${decision.projectId}`);
                return decision.groups && decision.groups.length > 0
                    ? decision.groups
                    : [AUTHENTICATED_GROUP];
            }
            this.logger.warn(`KuzzleAuth[apikey] denied identity=${decision && decision.identityId}`);
            return false;
        }
        catch (error) {
            this.logger.error(`KuzzleAuth[apikey] validation failed: ${error.message}`);
            return false;
        }
        finally {
            kuzzle.disconnect();
        }
    }
    async authenticateLegacy(user, password) {
        const kuzzle = this.newClient();
        try {
            await kuzzle.connect();
            await kuzzle.auth.login("local", { username: user, password });
            const currentUser = await kuzzle.auth.getCurrentUser();
            const profileIds = (currentUser && currentUser._source && currentUser._source.profileIds) ||
                [];
            if (!profileIds.includes("license-user")) {
                this.logger.warn(`KuzzleAuth[legacy] user '${user}' lacks the license-user profile`);
                return false;
            }
            this.logger.warn(`KuzzleAuth[legacy] DEPRECATED username/password auth used by '${user}' ` +
                `— migrate to a scoped API key (ADR-0001 Jalon F)`);
            return [AUTHENTICATED_GROUP, DEPRECATED_GROUP];
        }
        catch (error) {
            this.logger.error(`KuzzleAuth[legacy] login failed for user ${user}: ${error.message}`);
            return false;
        }
        finally {
            kuzzle.disconnect();
        }
    }
    authenticate(user, password, cb) {
        this.logger.info(`KuzzleAuth authenticate ${user}`);
        const routed = password.startsWith(API_KEY_PREFIX)
            ? this.authenticateApiKey(password)
            : this.authenticateLegacy(user, password);
        routed
            .then((groups) => cb(null, groups))
            .catch((error) => {
            this.logger.error(`KuzzleAuth authentication error: ${error.message}`);
            cb(null, false);
        });
    }
    register_middlewares(app) {
        const notice = this.config.deprecationNotice || DEFAULT_DEPRECATION_NOTICE;
        app.use((req, res, next) => {
            const groups = (req && req.remote_user && req.remote_user.groups) || [];
            if (groups.includes(DEPRECATED_GROUP)) {
                res.header("npm-notice", notice);
            }
            next();
        });
    }
}
exports.default = KuzzleAuth;
