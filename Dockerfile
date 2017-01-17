FROM node:4.6
RUN echo "deb http://http.debian.net/debian jessie-backports main" >> /etc/apt/sources.list

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y unzip \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y -t jessie-backports libgl1-mesa-glx libgl1-mesa-dri xserver-xorg-video-dummy xserver-xorg-input-mouse xserver-xorg-input-kbd

RUN echo "deb http://ftp.us.debian.org/debian testing main" >> /etc/apt/sources.list

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y -t testing gcc-5

ENV WORK /opt/mapgenerator

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Install app dependencies
COPY package.json ${WORK}
RUN npm install

# Bundle app source
COPY . ${WORK}

# Force rebuild
RUN echo `date` > builddate

# Fetch and import data
RUN curl http://dev.hsl.fi/infopoiminta/latest/all.zip > all.zip && \
  unzip all.zip -d ${WORK}/data/src && \
  node -r babel-register scripts/import.js

EXPOSE 8000

CMD cd ${WORK}/node_modules/hsl-map-style && \
  unzip -P ${FONTSTACK_PASSWORD} fontstack.zip && \
  cd ${WORK} && \
  Xorg -dpi 96 -nolisten tcp -noreset +extension GLX +extension RANDR +extension RENDER -logfile ./10.log -config ./xorg.conf :10 & \
  sleep 15 && \
  DISPLAY=":10" npm start
