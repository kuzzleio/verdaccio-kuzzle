FROM verdaccio/verdaccio:6 as builder
USER root
ENV NODE_ENV=production

ARG VERDACCIO_KUZZLE_VERSION=1.1.0

RUN npm i --global-style verdaccio-kuzzle@$VERDACCIO_KUZZLE_VERSION

FROM verdaccio/verdaccio:6
COPY config/config.yaml /verdaccio/conf/config.yaml
COPY --from=builder --chown=$VERDACCIO_USER_UID:root /opt/verdaccio/node_modules/verdaccio-kuzzle /verdaccio/plugins/verdaccio-kuzzle

