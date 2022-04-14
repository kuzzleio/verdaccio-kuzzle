FROM verdaccio/verdaccio:5 as builder
USER root
ENV NODE_ENV=production

RUN npm i --global-style verdaccio-kuzzle@1.0.6

FROM verdaccio/verdaccio:5
COPY config/config.yaml /verdaccio/conf/config.yaml
COPY --from=builder --chown=$VERDACCIO_USER_UID:root /opt/verdaccio/node_modules/verdaccio-kuzzle /verdaccio/plugins/verdaccio-kuzzle

