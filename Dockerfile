FROM node:10-buster-slim

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -yq libgl1-mesa-glx libgl1-mesa-dri libgles2-mesa xserver-xorg-video-dummy libjemalloc2 --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# shapr works better with jemalloc
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
ENV WORK /opt/mapgenerator

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Install app dependencies
COPY package.json yarn.lock ${WORK}/
RUN yarn && yarn cache clean

# Bundle app source
COPY . ${WORK}

RUN yarn run lint

EXPOSE 8000

CMD \
  cd ${WORK} && \
  Xorg -dpi 96 -nolisten tcp -noreset +extension GLX +extension RANDR +extension RENDER -logfile ./10.log -config ./xorg.conf :10 & \
  DISPLAY=":10" yarn forever start -c "yarn start" ./ && \
  yarn forever logs -f 0
