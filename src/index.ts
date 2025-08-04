import { AuthCallback, Logger, IPluginAuth } from "@verdaccio/types";
import { Kuzzle, Http } from "kuzzle-sdk";
import { User } from "kuzzle-sdk/src/core/security/User";

interface IKuzzleAuthConfig {
  url: string;
  port: number;
}

export default class KuzzleAuth implements IPluginAuth<IKuzzleAuthConfig> {
  private logger: Logger;
  private config: IKuzzleAuthConfig;

  constructor(config: IKuzzleAuthConfig, { logger }: { logger: Logger }) {
    this.logger = logger;
    this.config = config;

    this.logger.info(
      `KuzzleAuth initialized with config ${JSON.stringify(config)}`
    );
  }

  private async loginUser(kuzzle: Kuzzle, username: string, password: string) {
    try {
      await kuzzle.auth.login("local", {
        username,
        password,
      });
    } catch (error: any) {
      throw new Error(
        `KuzzleAuth login failed for user ${username}: ${error.message}`
      );
    }
  }

  private async processCurrentUser(user: User) {
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

      this.logger.info(
        `KuzzleAuth user ${user} has profiles: ${profileIds.join(", ")}`
      );

      if (!profileIds.includes("license-user")) {
        throw new Error(
          `User ${user} is not authorized with license-user profile`
        );
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private async logOutFromKuzzle(kuzzle: Kuzzle) {
    await kuzzle.auth.logout();
    kuzzle.disconnect();
  }

  public authenticate(user: string, password: string, cb: AuthCallback): void {
    const { url, port } = this.config;
    this.logger.info(`KuzzleAuth authenticate ${user}`);
    const kuzzle = new Kuzzle(new Http(url, { port }));

    kuzzle
      .connect()
      .then(() => {
        this.loginUser(kuzzle, user, password)
          .then(() => {
            return kuzzle.auth.getCurrentUser();
          })
          .then((currentUser) => {
            this.processCurrentUser(currentUser).then((isAuthorized) => {
              this.logOutFromKuzzle(kuzzle).then(() => {
                if (isAuthorized) {
                  cb(null, ["$authenticated"]);
                } else {
                  cb(null, false);
                }
              });
            });
          });
      })
      .catch((err: any) => {
        this.logger.error(err);
        cb(null, false);
      });
  }
}
