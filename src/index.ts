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
    this.logger.info(`KuzzleAuth authenticate ${user}`);
    const kuzzle = new Kuzzle(new WebSocket(url, { port }));

    kuzzle
      .connect()
      .then(() => {
        this.logger.info(`KuzzleAuth connected to ${url}:${port}`);
        kuzzle.auth
          .login("local", { username: user, password })
          .then((response) => {
            this.logger.info(`KuzzleAuth login success for ${user} with reponse ${JSON.stringify(response)}`);
            const groups: string[] = [];
            kuzzle.disconnect();
            cb(null, groups);
          })
          .catch((err: any) => {
            this.logger.error(err);
            kuzzle.disconnect();
            cb(null, false);
          })
      })
      .catch((err: any) => {
        this.logger.error(err);
        cb(null, false);
      });
  }
}
