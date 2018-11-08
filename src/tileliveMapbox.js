const Sphericalmercator = require('sphericalmercator');
const mbgl = require('@mapbox/mapbox-gl-native');
const Png = require('pngjs').PNG;
const PngQuant = require('pngquant');
const request = require('requestretry');
const url = require('url');
const fs = require('fs');
const concat = require('concat-stream');
const { createPool } = require('generic-pool');
const N_CPUS = require('os')
  .cpus().length;

const sm = new Sphericalmercator();

function pool(style, options) {
  async function create() {
    return new mbgl.Map(options);
  }

  async function destroy(map) {
    map.release();
    return true;
  }

  return createPool({
    create,
    destroy,
  }, {
    max: N_CPUS,
  });
}

function mbglRequest(req, callback) {
  const opts = {
    url: req.url,
    encoding: null,
    gzip: true,
  };

  const uri = url.parse(req.url);

  if (uri.protocol === 'file:') {
    fs.readFile(decodeURI(uri.hostname + uri.pathname), (err, data) => {
      if (err) {
        callback(err);
      } else {
        const response = {};
        response.data = data;
        callback(null, response);
      }
    });
  } else {
    request(opts, (err, res, body) => {
      const response = {};

      if (err) {
        // TODO: temporary hack to fix zero-size protobufs
        if (err.code === 'Z_BUF_ERROR') {
          callback(null, { data: Buffer.alloc(0) });
        } else {
          console.error(err, opts);
          callback(err);
        }
      } else if (res == undefined) {
        callback(null, { data: Buffer.alloc(0) });
      } else if (res.statusCode == 200) {
        if (res.headers.modified) { response.modified = new Date(res.headers.modified); }
        if (res.headers.expires) { response.expires = new Date(res.headers.expires); }
        if (res.headers.etag) { response.etag = res.headers.etag; }

        response.data = body;

        callback(null, response);
      } else if (res.statusCode == 404) {
        if (res.headers.modified) { response.modified = new Date(res.headers.modified); }
        if (res.headers.expires) { response.expires = new Date(res.headers.expires); }
        if (res.headers.etag) { response.etag = res.headers.etag; }

        response.data = Buffer.alloc(0);

        callback(null, response);
      } else {
        callback(new Error(body));
      }
    });
  }
}

class GL {
  constructor(options, callback) {
    if (!options || (typeof options !== 'object' && typeof options !== 'string')) return callback(new Error('options must be an object or a string'));
    if (!options.style) return callback(new Error('Missing GL style JSON'));

    this._scale = options.query.scale || 1;
    this._layerTileSize = options.query.layerTileSize || 512;

    this._pool = pool(options.style, {
      request: mbglRequest,
      ratio: this._scale,
    });

    const gl = this;
    setImmediate(callback, null, gl);
  }

  async getStatic(options) {
    const that = this;
    const map = await this._pool.acquire();

    // TODO: fix Style is not loaded error

    return new Promise((resolve, reject) => {
      map.render(options, (err, data) => {
        console.log(err);

        if (err) {
          reject(err);
          return;
        }

        that._pool.release(map);

        const width = Math.floor(options.width * that._scale);
        const height = Math.floor(options.height * that._scale);

        resolve({
          data,
          info: {
            width,
            height,
            channels: 4,
          },
        });
      });
    });
  }

  getInfo(callback) {
    callback(null, {});
  }
}

module.exports = GL;
module.exports.registerProtocols = function (tilelive) {
  // eslint-disable-next-line no-param-reassign
  tilelive.protocols['gl:'] = GL;
};
