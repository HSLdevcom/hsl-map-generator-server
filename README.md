
# HSL Map Generator Server

Server component for [hsl-map-publisher](https://github.com/HSLdevcom/hsl-map-publisher) and
[hsl-map-generator-ui](https://github.com/HSLdevcom/hsl-map-generator-ui).

### Install

Install dependencies:
```
yarn install
```

### Run

Set up xorg-server (may not be required):
```
apt install xserver-xorg-video-dummy
Xorg -dpi 96 -nolisten tcp -noreset +extension GLX +extension RANDR +extension RENDER -logfile ./10.log -config ./xorg.conf :10 &
export DISPLAY=":10"
```


Start server:
```
yarn start
```

Start server in development (hot-reload) mode:
```
yarn run watch
```
