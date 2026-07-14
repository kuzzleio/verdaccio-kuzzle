import {
  AuthCallback,
  IPluginAuth,
  IPluginMiddleware,
  Logger,
} from "@verdaccio/types";
import { Kuzzle, Http } from "kuzzle-sdk";

/**
 * Kuzzle API key tokens are prefixed with `kapikey-` (verified against Kuzzle
 * `security:createApiKey`). This prefix is the discriminator between the new
 * scoped-API-key auth (Path A) and the legacy username/password auth (Path B).
 */
const API_KEY_PREFIX = "kapikey-";

/** Group granting access to the private registry (Verdaccio `$authenticated`). */
const AUTHENTICATED_GROUP = "$authenticated";

/**
 * Extra group flagged on legacy (Path B) authentications. It carries the
 * deprecation signal to the middleware, which turns it into an `npm-notice`
 * response header. It is not a real ACL group.
 */
const DEPRECATED_GROUP = "legacy-deprecated";

/**
 * Default deprecation notice surfaced to npm clients still using the legacy
 * username/password auth. Overridable via `auth.kuzzle.deprecationNotice` in
 * the Verdaccio config (e.g. to point at the migration doc on staging).
 */
const DEFAULT_DEPRECATION_NOTICE =
  "[DEPRECATED] Kuzzle username/password registry authentication is being " +
  "retired. Create a scoped API key in the PaaS console (project > API keys) " +
  "and use it as your npm password instead.";

interface IKuzzleAuthConfig {
  url: string;
  port: number;
  /** Optional override for the deprecation notice shown to legacy clients. */
  deprecationNotice?: string;
}

/**
 * Decision returned by the console endpoint `registry:resolveAccess`
 * (ADR-0001, Jalon F1).
 */
interface RegistryAccessDecision {
  authorized: boolean;
  identityId: string;
  organizationId: string | null;
  projectId: string | null;
  groups: string[];
}

/**
 * Verdaccio authentication plugin for the Kuzzle-backed PaaS registry.
 *
 * ADR-0001 Jalon F migrates registry access from the global `license-user`
 * profile (username/password) to **scoped API keys** validated by the console.
 * The two schemes **coexist** during the transition (no flag day); the legacy
 * one is deprecated and retired at migration step 8.
 *
 * The `password` npm sends selects the path:
 *  - **Path A (scoped API key)** — `password` starts with `kapikey-`: the plugin
 *    authenticates to Kuzzle *with the key as its token* (so Kuzzle validates it;
 *    a revoked key's token is rejected upstream) and calls
 *    `registry:resolveAccess`. The console resolves the key's `api-key-links`
 *    binding and returns the decision + traces the access.
 *  - **Path B (legacy)** — otherwise: the historical `local` username/password
 *    login + `license-user` check. Grants the extra `legacy-deprecated` group so
 *    the middleware emits an `npm-notice`, and logs the usage server-side (the
 *    reliable channel for tracking who still needs to migrate).
 */
export default class KuzzleAuth
  implements
    IPluginAuth<IKuzzleAuthConfig>,
    IPluginMiddleware<IKuzzleAuthConfig>
{
  private logger: Logger;
  private config: IKuzzleAuthConfig;

  constructor(config: IKuzzleAuthConfig, { logger }: { logger: Logger }) {
    this.logger = logger;
    this.config = config;

    this.logger.info(
      `KuzzleAuth initialized with config ${JSON.stringify(config)}`
    );
  }

  private newClient(): Kuzzle {
    const { url, port } = this.config;
    return new Kuzzle(new Http(url, { port }));
  }

  /**
   * Path A — validate a scoped API key against the console endpoint.
   *
   * @param token - The API key token (npm password), prefixed `kapikey-`.
   * @returns The granted groups on success, or `false` when denied/invalid.
   */
  private async authenticateApiKey(token: string): Promise<string[] | false> {
    const kuzzle = this.newClient();

    try {
      await kuzzle.connect();
      // Authenticate AS the key: Kuzzle validates the token (a revoked key is
      // rejected here), and `registry:resolveAccess` runs as the identity.
      kuzzle.jwt = token;

      const response = await kuzzle.query({
        controller: "registry",
        action: "resolveAccess",
      });
      const decision = response.result as unknown as RegistryAccessDecision;

      if (decision && decision.authorized) {
        this.logger.info(
          `KuzzleAuth[apikey] authorized identity=${decision.identityId} ` +
            `org=${decision.organizationId} project=${decision.projectId}`
        );
        return decision.groups && decision.groups.length > 0
          ? decision.groups
          : [AUTHENTICATED_GROUP];
      }

      this.logger.warn(
        `KuzzleAuth[apikey] denied identity=${decision && decision.identityId}`
      );
      return false;
    } catch (error: any) {
      this.logger.error(`KuzzleAuth[apikey] validation failed: ${error.message}`);
      return false;
    } finally {
      kuzzle.disconnect();
    }
  }

  /**
   * Path B — legacy `local` username/password login + `license-user` check.
   * Deprecated: retired with the legacy flow at migration step 8.
   *
   * @param user - npm username.
   * @param password - npm password (a Kuzzle local credential).
   * @returns `["$authenticated", "legacy-deprecated"]` on success, else `false`.
   */
  private async authenticateLegacy(
    user: string,
    password: string
  ): Promise<string[] | false> {
    const kuzzle = this.newClient();

    try {
      await kuzzle.connect();
      await kuzzle.auth.login("local", { username: user, password });

      const currentUser = await kuzzle.auth.getCurrentUser();
      const profileIds: string[] =
        (currentUser && currentUser._source && currentUser._source.profileIds) ||
        [];

      if (!profileIds.includes("license-user")) {
        this.logger.warn(
          `KuzzleAuth[legacy] user '${user}' lacks the license-user profile`
        );
        return false;
      }

      // Deprecation tracking (ADR-0001 Jalon F3): the reliable channel is this
      // server-side log — who still authenticates via username/password.
      this.logger.warn(
        `KuzzleAuth[legacy] DEPRECATED username/password auth used by '${user}' ` +
          `— migrate to a scoped API key (ADR-0001 Jalon F)`
      );
      return [AUTHENTICATED_GROUP, DEPRECATED_GROUP];
    } catch (error: any) {
      this.logger.error(
        `KuzzleAuth[legacy] login failed for user ${user}: ${error.message}`
      );
      return false;
    } finally {
      kuzzle.disconnect();
    }
  }

  public authenticate(user: string, password: string, cb: AuthCallback): void {
    this.logger.info(`KuzzleAuth authenticate ${user}`);

    const routed = password.startsWith(API_KEY_PREFIX)
      ? this.authenticateApiKey(password)
      : this.authenticateLegacy(user, password);

    routed
      .then((groups) => cb(null, groups))
      .catch((error: any) => {
        this.logger.error(`KuzzleAuth authentication error: ${error.message}`);
        cb(null, false);
      });
  }

  /**
   * Registers a middleware that surfaces the deprecation notice to npm clients
   * authenticated via the legacy path (best-effort: npm prints the `npm-notice`
   * response header; behaviour varies by npm version, hence the server-side log
   * in {@link authenticateLegacy} is the reliable tracking channel).
   */
  public register_middlewares(app: any): void {
    const notice = this.config.deprecationNotice || DEFAULT_DEPRECATION_NOTICE;

    app.use((req: any, res: any, next: () => void) => {
      const groups: string[] = (req && req.remote_user && req.remote_user.groups) || [];
      if (groups.includes(DEPRECATED_GROUP)) {
        res.header("npm-notice", notice);
      }
      next();
    });
  }
}
