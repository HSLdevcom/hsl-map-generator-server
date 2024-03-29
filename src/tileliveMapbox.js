const mbgl = require('@maplibre/maplibre-gl-native');
const sharp = require('sharp');
const request = require('requestretry');
const url = require('url');
const fs = require('fs');
const { createPool } = require('generic-pool');
const N_CPUS = require('os').cpus().length;

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

  return createPool(
    {
      create,
      destroy,
    },
    {
      max: N_CPUS < 10 ? 10 : N_CPUS, // Minimum of 10 instances
      min: 1,
      evictionRunIntervalMillis: 1000 * 60, // Clean idle instances every minute
    },
  );
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
          // eslint-disable-next-line no-console
          console.error(err, opts);
          callback(err);
        }
      } else if (res === undefined) {
        callback(null, { data: Buffer.alloc(0) });
      } else if (res.statusCode === 200) {
        if (res.headers.modified) {
          response.modified = new Date(res.headers.modified);
        }
        if (res.headers.expires) {
          response.expires = new Date(res.headers.expires);
        }
        if (res.headers.etag) {
          response.etag = res.headers.etag;
        }

        response.data = body;

        callback(null, response);
      } else if (res.statusCode === 404) {
        if (res.headers.modified) {
          response.modified = new Date(res.headers.modified);
        }
        if (res.headers.expires) {
          response.expires = new Date(res.headers.expires);
        }
        if (res.headers.etag) {
          response.etag = res.headers.etag;
        }

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
    if (!options || (typeof options !== 'object' && typeof options !== 'string'))
      return callback(new Error('options must be an object or a string')); // eslint-disable-line no-constructor-return
    if (!options.style) return callback(new Error('Missing GL style JSON')); // eslint-disable-line no-constructor-return

    this._scale = options.query.scale || 1;
    this._bufferWidth = options.query.bufferWidth || 0;

    this._pool = pool(options.style, {
      request: mbglRequest,
      ratio: this._scale,
    });

    this.canceled = false;

    const gl = this;
    setImmediate(callback, null, gl);
  }

  clearPool() {
    this.canceled = true;

    return this._pool.drain().then(() => {
      this._pool.clear();
      this._pool = null;
    });
  }

  async getStatic(options, isCanceled) {
    if (this.canceled || !this._pool) {
      return false;
    }
    const renderOptions = {
      ...options,
      width: options.width + 2 * this._bufferWidth,
      height: options.height + 2 * this._bufferWidth,
    };
    const map = await this._pool.acquire();

    return new Promise((resolve, reject) => {
      // First cancel check before rendering the tile
      if (isCanceled()) {
        this.clearPool();
        reject(new Error('Render was canceled.'));
      } else {
        map.render(renderOptions, (err, data) => {
          if (err) {
            reject(err);
            return;
          }

          // Second canceled check before returning the tile
          if (isCanceled()) {
            this.clearPool();
            reject(new Error('Render was canceled.'));
          } else {
            this._pool.release(map);

            const renderWidth = Math.floor(renderOptions.width * this._scale);
            const renderHeight = Math.floor(renderOptions.height * this._scale);

            const imageWidth = Math.floor(options.width * this._scale);
            const imageHeight = Math.floor(options.height * this._scale);
            sharp(data, {
              raw: {
                width: renderWidth,
                height: renderHeight,
                channels: 4,
              },
            })
              .extract({
                left: Math.floor(this._scale * this._bufferWidth),
                top: Math.floor(this._scale * this._bufferWidth),
                width: imageWidth,
                height: imageHeight,
              })
              .toBuffer()
              .then((image) => {
                resolve({
                  data: image,
                  info: {
                    width: imageWidth,
                    height: imageHeight,
                    channels: 4,
                  },
                });
              });
          }
        });
      }
    });
  }
}

module.exports = GL;
// eslint-disable-next-line func-names
module.exports.registerProtocols = function (tilelive) {
  // eslint-disable-next-line no-param-reassign
  tilelive.protocols['gl:'] = GL;
};
