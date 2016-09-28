
# HSL Map Generator Server

Server component for [hsl-map-web-ui](https://github.com/HSLdevcom/hsl-map-web-ui),
[hsl-map-publisher](https://github.com/HSLdevcom/hsl-map-publisher) and
[hsl-map-generator-ui](https://github.com/HSLdevcom/hsl-map-generator-ui).

### Install

Install dependencies:
```
npm install
```

Download and extract [http://dev.hsl.fi/infopoiminta/latest/](http://dev.hsl.fi/infopoiminta/latest/) to `data/src`.

Convert relevant DAT files to JSON:
```
node -r babel-register scripts/import.js
```

### Run

Start server:
```
node -r babel-register src/server.js
```

Generate driver instruction maps and mapbox-gl style files with embedded route
data from the imported JORE data dumps:
```
node -r babel-register scripts/routeMapsGenerator.js
```
