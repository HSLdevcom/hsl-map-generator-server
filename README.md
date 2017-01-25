
# HSL Map Generator Server

Server component for [hsl-map-web-ui](https://github.com/HSLdevcom/hsl-map-web-ui),
[hsl-map-publisher](https://github.com/HSLdevcom/hsl-map-publisher) and
[hsl-map-generator-ui](https://github.com/HSLdevcom/hsl-map-generator-ui).

### Install

Install dependencies:
```
npm install
```

Extract `fontstack.zip` from [hsl-map-style](https://github.com/hsldevcom/hsl-map-style) to `public`.

Download and extract [http://dev.hsl.fi/infopoiminta/latest/](http://dev.hsl.fi/infopoiminta/latest/) to `data/src`.

Convert relevant DAT files to JSON:
```
npm import
```

### Run

Start server:
```
npm start
```

Start server in development mode:
```
npm run watch
```

Build production version to `dist`:
```
npm run build
```
