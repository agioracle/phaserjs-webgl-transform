const noop = () => {};
let _startHandler, _moveHandler, _endHandler, _cancelHandler;

function mapTouch(wxTouch, dpr, canvas) {
  const invDpr = 1 / dpr;
  return {
    identifier: wxTouch.identifier,
    clientX: wxTouch.clientX * invDpr, clientY: wxTouch.clientY * invDpr,
    pageX: wxTouch.pageX * invDpr, pageY: wxTouch.pageY * invDpr,
    screenX: wxTouch.screenX * invDpr, screenY: wxTouch.screenY * invDpr,
    target: canvas,
  };
}

function createSyntheticEvent(type, wxEvent, dpr, canvas) {
  return {
    type,
    touches: (wxEvent.touches || []).map(t => mapTouch(t, dpr, canvas)),
    changedTouches: (wxEvent.changedTouches || []).map(t => mapTouch(t, dpr, canvas)),
    timeStamp: wxEvent.timeStamp,
    preventDefault: noop, stopPropagation: noop,
  };
}

export function initTouchBridge(canvas, dpr) {
  _startHandler = e => canvas.dispatchEvent(createSyntheticEvent('touchstart', e, dpr, canvas));
  _moveHandler = e => canvas.dispatchEvent(createSyntheticEvent('touchmove', e, dpr, canvas));
  _endHandler = e => canvas.dispatchEvent(createSyntheticEvent('touchend', e, dpr, canvas));
  _cancelHandler = e => canvas.dispatchEvent(createSyntheticEvent('touchcancel', e, dpr, canvas));
  wx.onTouchStart(_startHandler); wx.onTouchMove(_moveHandler);
  wx.onTouchEnd(_endHandler); wx.onTouchCancel(_cancelHandler);
}

export function destroyTouchBridge() {
  if (_startHandler) wx.offTouchStart(_startHandler);
  if (_moveHandler) wx.offTouchMove(_moveHandler);
  if (_endHandler) wx.offTouchEnd(_endHandler);
  if (_cancelHandler) wx.offTouchCancel(_cancelHandler);
  _startHandler = _moveHandler = _endHandler = _cancelHandler = null;
}
