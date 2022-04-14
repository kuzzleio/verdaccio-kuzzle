# About

## Verdaccio kuzzle

This is the official Kuzzle verdaccio authentication plugin.

This plugins allows you to connect to [verdaccio](https://verdaccio.org/) packages proxy registry using kuzzle users.

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
