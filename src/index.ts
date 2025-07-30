import { AuthCallback, Logger, IPluginAuth } from "@verdaccio/types";
import { Kuzzle, Http } from "kuzzle-sdk";

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

  authenticate(user: string, password: string, cb: AuthCallback): void {
    const { url, port } = this.config;
    this.logger.info(`KuzzleAuth authenticate ${user}`);
    const kuzzle = new Kuzzle(new Http(url, { port }));

    kuzzle
      .connect()
      .then(() => {
        this.logger.info(`KuzzleAuth connected to ${url}:${port}`);
        kuzzle.auth
          .login("local", { username: user, password })
          .then((response) => {
            this.logger.info(
              `KuzzleAuth login success for ${user} with reponse ${JSON.stringify(
                response
              )}`
            );

            return kuzzle.auth.getCurrentUser();
          })
          .then((currentUser) => {
            this.logger.info(
              `KuzzleAuth current user retrieved: ${JSON.stringify(currentUser)}`
            );

            if (currentUser && currentUser._source.profileIds) {
              const profileIds = currentUser._source.profileIds;
              this.logger.info(
                `KuzzleAuth user ${user} has profiles: ${profileIds.join(", ")}`
              );

              if (profileIds.includes("license-user")) {
                this.logger.info(
                  `KuzzleAuth user ${user} is authorized with license-user profile`
                );
                cb(null, ["$authenticated"]);
              }
            }

            this.logger.info(`KuzzleAuth user ${user} is not authorized`);
            cb(null, false);
          })
          .catch((err: any) => {
            this.logger.error(err);
            cb(null, false);
          })
          .finally(() => {
            kuzzle.auth.logout()
              .then(() => {
                this.logger.info(`KuzzleAuth logged out user ${user}`);
                kuzzle.disconnect();
              })
              .catch((logoutErr: any) => {
                this.logger.error(`KuzzleAuth logout error: ${logoutErr}`);
                kuzzle.disconnect();
              });
          });
      })
      .catch((err: any) => {
        this.logger.error(err);
        kuzzle.disconnect();
        cb(null, false);
      });
  }
}
