FROM ubuntu:24.04

# Install Node.js 20 from NodeSource
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -yq curl ca-certificates --no-install-recommends \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -yq nodejs \
  && npm install -g yarn \
  && rm -rf /var/lib/apt/lists/*

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -yq \
  wget xserver-xorg-video-dummy libjemalloc2 \
  # maplibre-native dependencies
  ccache cmake ninja-build pkg-config xvfb \
  libcurl4-openssl-dev libglfw3-dev libuv1-dev \
  g++ libc++-dev libc++abi-dev \
  libpng-dev libgl1-mesa-dev libgl1-mesa-dri \
  # runtime deps required by maplibre-gl-native prebuilt binary
  libwebp-dev libjpeg-dev libicu-dev \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# shapr works better with jemalloc
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
ENV WORK=/opt/mapgenerator
ENV NODE_ENV=production

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Install app dependencies
COPY package.json yarn.lock ${WORK}/
RUN yarn && yarn cache clean

# Bundle app source
COPY . ${WORK}

# RUN yarn run lint

EXPOSE 8000

CMD \
  cd ${WORK} && \
  Xorg -dpi 96 -nolisten tcp -noreset +extension GLX +extension RANDR +extension RENDER -logfile ./10.log -config ./xorg.conf :10 & \
  DISPLAY=":10" yarn start
