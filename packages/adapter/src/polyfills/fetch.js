class WxResponse {
  constructor(data, status, statusText, headers = {}) {
    this._data = data;
    this.status = status;
    this.statusText = statusText;
    this.ok = status >= 200 && status < 300;
    this.headers = new Map(Object.entries(headers));
    this.type = 'basic';
    this.url = '';
  }
  async json() { return typeof this._data === 'string' ? JSON.parse(this._data) : this._data; }
  async text() { return typeof this._data === 'string' ? this._data : JSON.stringify(this._data); }
  async arrayBuffer() { return this._data; }
  clone() { return new WxResponse(this._data, this.status, this.statusText, Object.fromEntries(this.headers)); }
}

export default function wxFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      header: headers,
      data: options.body,
      dataType: 'text',
      responseType: 'text',
      success(res) {
        resolve(new WxResponse(res.data, res.statusCode, res.statusCode === 200 ? 'OK' : '', res.header || {}));
      },
      fail(err) {
        reject(new TypeError(err.errMsg || 'Network request failed'));
      },
    });
  });
}

export { WxResponse };
