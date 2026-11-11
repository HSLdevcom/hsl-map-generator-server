# HSL Map Generator Server

Server component for [hsl-map-publisher](https://github.com/HSLdevcom/hsl-map-publisher) and
[hsl-map-generator-ui](https://github.com/HSLdevcom/hsl-map-generator-ui).

Requires Node.js 24. The prebuilt `@maplibre/maplibre-gl-native` binary is built on Ubuntu 24.04
and needs glibc 2.38, ICU 74 and libjpeg-turbo8, so the Docker image runs on `ubuntu:24.04` with
Node copied from the HSL base image.

## Install

Install dependencies:

```bash
npm install
```

## Run

Set up xorg-server (may not be required):

```bash
apt install xserver-xorg-video-dummy
Xorg -dpi 96 -nolisten tcp -noreset +extension GLX +extension RANDR +extension RENDER -logfile ./10.log -config ./xorg.conf :10 &
export DISPLAY=":10"
```

Start server:

```bash
npm start
```

Start server in development (hot-reload) mode:

```bash
npm run watch
```

## Check and test

```bash
npm run check-and-build
```

This runs ESLint and Prettier, then the unit tests (`node --test`, writes `lcov.info` and
`junit.xml`). The unit tests do not load the native renderer.

## Docker

```bash
docker build --target production -t hsl-map-generator-server .
docker run -p 8000:8000 hsl-map-generator-server
```

## Releases

CI publishes `hsldevcom/hsl-map-generator-server:edge` from `main` and `X.Y.Z` images from `v*`
tags. To release, run `npm version <x.y.z>` and `git push --follow-tags`.
