import { Callback, Logger, IPluginAuth } from "@verdaccio/types";
import { Kuzzle, WebSocket } from "kuzzle-sdk";

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

  authenticate(user: string, password: string, cb: Callback): void {
    const { url, port } = this.config;
    this.logger.info(`KuzzleAuth authenticate ${user} with ${url}:${port}`);
    const kuzzle = new Kuzzle(new WebSocket(url, { port }));

    kuzzle
      .connect()
      .then(() => {
        kuzzle.auth
          .login("local", { username: user, password })
          .then(() => {
            const groups: string[] = [];
            cb(null, groups);
          })
          .catch((err: any) => {
            this.logger.error(err);
            cb(null, false);
          })
          .finally(() => {
            kuzzle.disconnect();
          });
      })
      .catch((err: any) => {
        this.logger.error(err);
        cb(null, false);
      });
  }
}
