FROM node:6
RUN echo "deb http://http.debian.net/debian jessie-backports main" >> /etc/apt/sources.list

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y unzip \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y -t jessie-backports libgl1-mesa-glx libgl1-mesa-dri libgles2-mesa xserver-xorg-video-dummy xserver-xorg-input-mouse xserver-xorg-input-kbd

RUN echo "deb http://ftp.us.debian.org/debian testing main" >> /etc/apt/sources.list

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y -t testing gcc-6

ENV WORK /opt/mapgenerator

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Install app dependencies
COPY package.json ${WORK}
RUN npm install

# Bundle app source
COPY . ${WORK}

EXPOSE 8000

CMD cd ${WORK}/node_modules/hsl-map-style && \
  unzip -P ${FONTSTACK_PASSWORD} fontstack.zip && \
  cd ${WORK} && \
  Xorg -dpi 96 -nolisten tcp -noreset +extension GLX +extension RANDR +extension RENDER -logfile ./10.log -config ./xorg.conf :10 & \
  sleep 15 && \
  DISPLAY=":10" node_modules/.bin/forever start -c "npm start" ./ && \
  sleep 10 && node_modules/.bin/forever --fifo logs 0
