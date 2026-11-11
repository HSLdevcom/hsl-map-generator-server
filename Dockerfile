# Node 24 comes from the HSL base image, but the runtime OS stays Ubuntu 24.04 (noble).
# The prebuilt @maplibre/maplibre-gl-native binary (lib/node-v137/mbgl.node) is built on
# Ubuntu 24.04: it needs GLIBC_2.38, GLIBCXX_3.4.32, libicu*.so.74 and libjpeg.so.8.
# The HSL base image is Debian bookworm (glibc 2.36, GLIBCXX_3.4.30, ICU 72, libjpeg62),
# so the renderer cannot load there.
FROM hsldevcom/infodevops-docker-base-images:1.1.0-24-node AS node

FROM ubuntu:24.04 AS production

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Runtime libraries of the maplibre-gl-native prebuilt binary, Xorg with the dummy driver and
# mesa (software GL) for headless rendering, jemalloc for sharp.
# DL3008: apt packages are intentionally unpinned (the Ubuntu archive only keeps the latest).
# hadolint ignore=DL3008
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends \
    ca-certificates tini \
    xserver-xorg-core xserver-xorg-video-dummy \
    libgl1-mesa-dri libglx-mesa0 libopengl0 libglx0 libx11-6 libxext6 \
    libcurl4t64 libuv1t64 libpng16-16t64 libwebp7 libjpeg-turbo8 libicu74 \
    libjemalloc2 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && node --version && npm --version

# sharp works better with jemalloc
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
ENV WORK=/opt/mapgenerator
ENV NODE_ENV=production

# Run as the unprivileged uid 1000 user like the HSL base image does: rename Ubuntu's default
# user to node. Xorg with the dummy driver runs unprivileged; it needs the X socket directory.
RUN usermod -l node -d /home/node -m ubuntu \
  && groupmod -n node ubuntu \
  && mkdir -p ${WORK} /tmp/.X11-unix \
  && chmod 1777 /tmp/.X11-unix \
  && chown node:node ${WORK}

WORKDIR ${WORK}
USER node

# Install app dependencies
COPY --chown=node:node package.json package-lock.json ${WORK}/
RUN npm ci --omit=dev && npm cache clean --force

# Bundle app source
COPY --chown=node:node . ${WORK}

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "Xorg -dpi 96 -nolisten tcp -noreset +extension GLX +extension RANDR +extension RENDER -logfile ./10.log -config ./xorg.conf :10 & DISPLAY=:10 exec node src/server.js"]
