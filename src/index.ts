import { Callback, Logger, IPluginAuth } from "@verdaccio/types";
import { Kuzzle, WebSocket } from "kuzzle-sdk";

interface IKuzzleAuthConfig {
  url: string;
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
    this.logger.info(`KuzzleAuth authenticate ${user}`);
    const { url } = this.config;
    const kuzzle = new Kuzzle(new WebSocket(url));

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
  }
}
