FROM node:8.15

RUN echo "deb http://ftp.us.debian.org/debian testing main" >> /etc/apt/sources.list
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -yq -t testing gcc-6

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -yq libgl1-mesa-glx libgl1-mesa-dri libgles2-mesa xserver-xorg-video-dummy

ENV WORK /opt/mapgenerator

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Install app dependencies
COPY package.json ${WORK}
COPY yarn.lock ${WORK}
RUN yarn

# Bundle app source
COPY . ${WORK}

RUN yarn run lint

EXPOSE 8000

CMD \
  cd ${WORK} && \
  Xorg -dpi 96 -nolisten tcp -noreset +extension GLX +extension RANDR +extension RENDER -logfile ./10.log -config ./xorg.conf :10 & \
  sleep 15 && \
  DISPLAY=":10" node_modules/.bin/forever start -c "npm start" ./ && \
  sleep 10 && \
  node_modules/.bin/forever logs -f 0
