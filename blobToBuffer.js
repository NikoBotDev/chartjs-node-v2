/**
 * @param {Blob} blob blob to me converted.
 * @param {Function} cb callback function
 */
module.exports = (blob, cb) => {
  // eslint-disable-next-line no-undef
  const reader = new FileReader();

  // eslint-disable-next-line id-length
  function onLoadEnd(e) {
    reader.removeEventListener('loadend', onLoadEnd, false);
    if (e.error) cb(e.error);
    else cb(null, Buffer.from(reader.result));
  }

  reader.addEventListener('loadend', onLoadEnd, false);
  reader.readAsArrayBuffer(blob);
};
