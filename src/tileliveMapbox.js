const mbgl = require('@mapbox/mapbox-gl-native');
const request = require('requestretry');
const url = require('url');
const fs = require('fs');
const { createPool } = require('generic-pool');
const N_CPUS = require('os')
  .cpus().length;

function pool(style, options) {
  async function create() {
    const map = new mbgl.Map(options);
    await map.load(style);
    return map;
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
      } else if (res == undefined) { // eslint-disable-line eqeqeq
        callback(null, { data: Buffer.alloc(0) });
      } else if (res.statusCode == 200) { // eslint-disable-line eqeqeq
        if (res.headers.modified) { response.modified = new Date(res.headers.modified); }
        if (res.headers.expires) { response.expires = new Date(res.headers.expires); }
        if (res.headers.etag) { response.etag = res.headers.etag; }

        response.data = body;

        callback(null, response);
      } else if (res.statusCode == 404) { // eslint-disable-line eqeqeq
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

    this._pool = pool(options.style, {
      request: mbglRequest,
      ratio: this._scale,
    });

    this.canceled = false;

    const gl = this;
    setImmediate(callback, null, gl);
  }

  onCanceled() {
    this.canceled = true;

    this._pool.drain().then(() => {
      this._pool.clear();
    });
  }

  async getStatic(options, isCanceled) {
    const that = this;

    if (this.canceled) {
      return false;
    }

    const map = await this._pool.acquire();

    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      // First cancel check before rendering the tile
      if (isCanceled()) {
        that.onCanceled();
        reject(new Error('Render was canceled.'));
      } else {
        map.render(options, (err, data) => {
          if (err) {
            reject(err);
            return;
          }

          // Second canceled check before returning the tile
          if (isCanceled()) {
            that.onCanceled();
            reject(new Error('Render was canceled.'));
          } else {
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
          }
        });
      }
    });
  }
}

module.exports = GL;
module.exports.registerProtocols = function (tilelive) {
  // eslint-disable-next-line no-param-reassign
  tilelive.protocols['gl:'] = GL;
};
