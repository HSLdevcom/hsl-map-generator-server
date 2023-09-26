FROM node:16-bullseye-slim

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -yq wget xserver-xorg-video-dummy libjemalloc2 \
  # maplibre-native dependencies
  ccache cmake ninja-build pkg-config xvfb libcurl4-openssl-dev libglfw3-dev libuv1-dev g++-10 libc++-9-dev libc++abi-9-dev libpng-dev libgl1-mesa-dev libgl1-mesa-dri --no-install-recommends \
  && wget http://archive.ubuntu.com/ubuntu/pool/main/libj/libjpeg-turbo/libjpeg-turbo8_2.0.3-0ubuntu1_amd64.deb \
  && apt install ./libjpeg-turbo8_2.0.3-0ubuntu1_amd64.deb \
  && wget http://archive.ubuntu.com/ubuntu/pool/main/i/icu/libicu66_66.1-2ubuntu2_amd64.deb \
  && apt install ./libicu66_66.1-2ubuntu2_amd64.deb \
  && rm ./*.deb \
  && rm -rf /var/lib/apt/lists/*

# shapr works better with jemalloc
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
ENV WORK /opt/mapgenerator
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
