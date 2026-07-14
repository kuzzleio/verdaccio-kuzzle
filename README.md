# About

## Verdaccio kuzzle

This is the official Kuzzle verdaccio authentication plugin.

This plugins allows you to connect to [verdaccio](https://verdaccio.org/) packages proxy registry using kuzzle credentials.

## Authentication

The plugin supports two authentication schemes that **coexist** (PaaS IAM migration, ADR-0001 Jalon F). The npm `password` selects the path:

- **Scoped API key (recommended).** When the password starts with `kapikey-`, the plugin authenticates to Kuzzle with the key as its token and calls the PaaS console endpoint `registry:resolveAccess`. The console validates the key against its `api-key-links` binding (a revoked key is rejected), resolves the `(identity, project)` it maps to for traceability, and returns the access decision. Create a scoped key in the PaaS console (project → API keys) and use it as your npm password:

  ```sh
  npm config set //<registry-host>/:_password "$(echo -n 'kapikey-…' | base64)"
  npm config set //<registry-host>/:username paas
  ```

- **Username / password (deprecated).** The historical `local` login checking the global `license-user` profile. It still works during the transition but is **deprecated**: clients get an `npm-notice` on responses, its usage is logged server-side, and it is removed with the legacy flow at migration step 8. Migrate to a scoped API key.

### Configuration

```yaml
auth:
  kuzzle:
    url: localhost
    port: 7512
    # Optional: override the deprecation notice shown to legacy clients.
    deprecationNotice: "Migrate to an API key — see https://…"
```

## Kuzzle

Kuzzle is an open-source backend that includes a scalable server, a multiprotocol API,
an administration console and a set of plugins that provide advanced functionalities like real-time pub/sub, blazing fast search and geofencing.

* :octocat: __[Github](https://github.com/kuzzleio/kuzzle)__
* :earth_africa: __[Website](https://kuzzle.io)__
* :books: __[Documentation](https://docs.kuzzle.io)__

## Compatibility matrix

| Kuzzle Version | Plugin Version |
| -------------- | -------------- |
| >= 2           | 1.x.x          |

## Tests

To test it with a local kuzzle

```sh
docker-compose up --build
```

* Then Kuzzle should be up at port 7512
* Then Verdaccio should be up at port 4873

1. Create a user on kuzzle, then try to login with it on verdaccio UI.
