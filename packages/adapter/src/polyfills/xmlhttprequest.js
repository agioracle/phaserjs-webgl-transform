const READY_STATE = { UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4 };

/**
 * Detect whether a URL is a local file path (not a remote HTTP/data/blob URL).
 */
function _isLocalPath(url) {
  if (!url || typeof url !== 'string') return false;
  if (/^https?:\/\//i.test(url)) return false;
  if (/^\/\//.test(url)) return false;        // protocol-relative
  if (/^data:/i.test(url)) return false;
  if (/^blob:/i.test(url)) return false;
  if (/^wxblob:/i.test(url)) return false;
  if (/^wxfile:/i.test(url)) return false;     // wx temp file protocol
  return true;
}

export default class WxXMLHttpRequest {
  constructor() {
    this.readyState = READY_STATE.UNSENT;
    this.status = 0;
    this.statusText = '';
    this.response = null;
    this.responseText = '';
    this.responseType = '';
    this.timeout = 0;
    this._method = 'GET';
    this._url = '';
    this._headers = {};
    this._task = null;

    // Event callbacks
    this.onload = null;
    this.onerror = null;
    this.onprogress = null;
    this.onreadystatechange = null;
    this.ontimeout = null;
    this.onabort = null;
  }

  open(method, url) {
    this._method = method;
    this._url = url;
    this.readyState = READY_STATE.OPENED;
    if (this.onreadystatechange) this.onreadystatechange();
  }

  setRequestHeader(name, value) {
    this._headers[name] = value;
  }

  send(data) {
    // --- Local file path: read directly via wx file system ---
    if (_isLocalPath(this._url)) {
      this._sendLocal();
      return;
    }

    const isBinary = this.responseType === 'arraybuffer' || this.responseType === 'blob';

    if (isBinary) {
      this._task = wx.downloadFile({
        url: this._url,
        timeout: this.timeout || undefined,
        success: (res) => {
          if (res.statusCode === 200) {
            const fs = wx.getFileSystemManager();
            try {
              const arrayBuffer = fs.readFileSync(res.tempFilePath);
              this.status = 200;
              this.statusText = 'OK';
              this.response = arrayBuffer;
              this.readyState = READY_STATE.DONE;
              if (this.onreadystatechange) this.onreadystatechange();
              if (this.onload) this.onload();
            } catch (err) {
              this._handleError(err);
            }
          } else {
            this.status = res.statusCode;
            this._handleError(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail: (err) => this._handleError(err),
      });
    } else {
      this._task = wx.request({
        url: this._url,
        method: this._method,
        header: this._headers,
        data: data,
        dataType: this.responseType === 'json' ? 'json' : 'text',
        timeout: this.timeout || undefined,
        success: (res) => {
          this.status = res.statusCode;
          this.statusText = res.statusCode === 200 ? 'OK' : '';
          this.response = res.data;
          this.responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
          this.readyState = READY_STATE.DONE;
          if (this.onreadystatechange) this.onreadystatechange();
          if (this.onload) this.onload();
        },
        fail: (err) => this._handleError(err),
      });
    }
  }

  /**
   * Read a local file path using wx.getFileSystemManager().
   */
  _sendLocal() {
    try {
      const fsm = wx.getFileSystemManager();
      const isBinary = this.responseType === 'arraybuffer' || this.responseType === 'blob';

      if (isBinary) {
        // Binary read — returns ArrayBuffer
        const arrayBuffer = fsm.readFileSync(this._url);
        this.status = 200;
        this.statusText = 'OK';
        this.response = arrayBuffer;
        this.readyState = READY_STATE.DONE;
        if (this.onreadystatechange) this.onreadystatechange();
        if (this.onload) this.onload();
      } else {
        // Text read
        const text = fsm.readFileSync(this._url, 'utf-8');
        this.status = 200;
        this.statusText = 'OK';
        if (this.responseType === 'json') {
          this.response = JSON.parse(text);
          this.responseText = text;
        } else {
          this.response = text;
          this.responseText = text;
        }
        this.readyState = READY_STATE.DONE;
        if (this.onreadystatechange) this.onreadystatechange();
        if (this.onload) this.onload();
      }
    } catch (err) {
      this._handleError(err);
    }
  }

  abort() {
    if (this._task && this._task.abort) this._task.abort();
    if (this.onabort) this.onabort();
  }

  _handleError(err) {
    this.readyState = READY_STATE.DONE;
    if (this.onreadystatechange) this.onreadystatechange();
    if (this.onerror) this.onerror(err);
  }

  getAllResponseHeaders() { return ''; }
  getResponseHeader() { return null; }
}

// Expose constants
WxXMLHttpRequest.UNSENT = READY_STATE.UNSENT;
WxXMLHttpRequest.OPENED = READY_STATE.OPENED;
WxXMLHttpRequest.HEADERS_RECEIVED = READY_STATE.HEADERS_RECEIVED;
WxXMLHttpRequest.LOADING = READY_STATE.LOADING;
WxXMLHttpRequest.DONE = READY_STATE.DONE;
