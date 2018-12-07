'use strict';
const BbPromise = require('bluebird');
const {JSDOM} = require('jsdom');
const fs = BbPromise.promisifyAll(require('fs'));
const streamBuffers = require('stream-buffers');
const EventEmitter = require('events');
const Chartjs = require('chart.js');
const toBuffer = require('./blobToBuffer');
const canvas = require('canvas');
class ChartjsNode extends EventEmitter {
  /**
     * Creates an instance of ChartjsNode.
     * @param {number} width The width of the chart canvas.
     * @param {number} height The height of the chart canvas.
     * @param {number} devicePixelRatio
     */
  constructor(width, height, devicePixelRatio) {
    super();
    this._width = width;
    this._height = height;
    this._devicePixelRatio = devicePixelRatio || 1;
    /**
     * @type {?JSDOM}
     */
    this._dom = null;
  }
  /**
     * @return {Number} the width of the chart/canvas in pixels
     */
  get width() {
    return this._width;
  }
  /**
     * @return {Number} the height of the chart/canvas in pixels
     */
  get height() {
    return this._height;
  }
  _disableDynamicChartjsSettings(configuration) {
    configuration.options.responsive = false;
    configuration.options.animation = false;
    configuration.options.width = this.width;
    configuration.options.height = this.height;
  }
  /**
     * Draws the chart given the Chart.js configuration
     * @param {Object} configuration
     * @return {Promise} A promise that will resolve when the chart is completed
     */
  drawChart(configuration) {
    return new BbPromise((resolve) => {
      // ensure we clean up any existing window if drawChart was called more than once.
      this.destroy();
      this._dom = new JSDOM(`<html>
        <body>
            <div id="chart-div" style="font-size:40;  width:${this.width}; height:${this.height};">
                <canvas id="myChart" width=${this.width} height=${this.height}></canvas>
            </div>
        </body>
    </html>`, {runScripts: 'dangerously', url: 'https://example.org/'});
      this._dom.defaultDocumentFeatures = {
        FetchExternalResources: ['script'],
        ProcessExternalResources: true,
      };
      const {window} = this._dom;
      window.devicePixelRatio = this._devicePixelRatio;
      this._window = window;

      const canvasMethods = ['HTMLCanvasElement'];

      // adding window properties to global (only properties that are not already defined).
      this._windowPropertiesToDestroy = [];
      Object.keys(window).forEach((property) => {
        if (typeof global[property] === 'undefined') {
          if (typeof global[property] === 'undefined') {
            global[property] = window[property];
            this._windowPropertiesToDestroy.push(property);
          }
        }
      });

      // adding all window.HTMLCanvasElement methods to global.HTMLCanvasElement
      canvasMethods.forEach((method) =>
        global[method] = window[method]
      );
      if (configuration.options.fonts) {
        if (Array.isArray(configuration.options.fonts)) {
          for (const font of configuration.options.fonts) {
            canvas.registerFont(font.path, {family: font.family});
          }
        } else {
          canvas.registerFont(configuration.options.fonts.path, {family: configuration.options.fonts.family});
        }
      }
      global.CanvasRenderingContext2D = canvas.Context2d;
      global.navigator = {
        userAgent: 'node.js',
      };


      this.emit('beforeDraw', Chartjs);
      if (configuration.options.plugins) {
        Chartjs.pluginService.register(configuration.options.plugins);
      }
      if (configuration.options.charts) {
        configuration.options.charts.forEach((chart) => {
          Chartjs.defaults[chart.type] = chart.defaults || {};
          if (chart.baseType) {
            Chartjs.controllers[chart.type] = Chartjs.controllers[chart.baseType].extend(chart.controller);
          } else {
            Chartjs.controllers[chart.type] = Chartjs.DatasetController.extend(chart.controller);
          }
        });
      }

      this._disableDynamicChartjsSettings(configuration);
      this._canvas = window.document.getElementById('myChart');

      this._ctx = this._canvas.getContext('2d');
      this._chart = new Chartjs(this._ctx, configuration);

      resolve(this._chart);
    });
  }
  /**
     * Retrives the drawn chart as a stream
     *
     * @param {String} imageType The image type name. Valid values are image/png image/jpeg
     * @return {Stream} The image as an in-memory stream
     */
  getImageStream(imageType) {
    return this.getImageBuffer(imageType)
        .then((buffer) => {
          const readableStream = new streamBuffers.ReadableStreamBuffer({
            frequency: 10, // in milliseconds.
            chunkSize: 2048, // in bytes.
          });
          readableStream.put(buffer);
          readableStream.stop();
          return {
            stream: readableStream,
            length: buffer.length,
          };
        });
  }
  /**
     * Retrives the drawn chart as a buffer
     *
     * @param {String} imageType The image type name. Valid values are image/png image/jpeg
     * @return {Array} The image as an in-memory buffer
     */
  getImageBuffer(imageType) {
    return new BbPromise((resolve, reject) => {
      this._canvas.toBlob((blob, err) => {
        if (err) {
          return reject(err);
        }
        toBuffer(blob, function(err, buffer) {
          if (err) throw err;
          return resolve(buffer);
        });
      }, imageType);
    });
  }
  /**
     * Returns image in the form of Data Url
     *
     * @param {String} imageType The image type name. Valid values are image/png image/jpeg
     * @return {Promise} A promise that resolves when the image is received in the form of data url
     */
  getImageDataUrl(imageType) {
    return new BbPromise((resolve, reject) => {
      this._canvas.toDataURL(imageType, (err, img) => {
        if (err) {
          return reject(err);
        }
        return resolve(img);
      });
    });
  }
  /**
     * Writes chart to a file
     *
     * @param {String} imageType The image type name. Valid values are image/png image/jpeg
     * @param {string} filePath file path where the file will be saved.
     * @return {Promise} A promise that resolves when the image is written to a file
     */
  writeImageToFile(imageType, filePath) {
    return this.getImageBuffer(imageType)
        .then((buffer) => {
          return new BbPromise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            out.on('finish', () => {
              return resolve();
            });
            out.on('error', (err) => {
              return reject(err);
            });
            out.write(buffer);
            out.end();
          });
        });
  }
  /**
     * Destroys the virtual DOM and canvas -- releasing any native resources
     */
  destroy() {
    if (this._chart) {
      this._chart.destroy();
    }

    if (this._windowPropertiesToDestroy) {
      this._windowPropertiesToDestroy.forEach((prop) => {
        delete global[prop];
      });
    }

    if (this._window) {
      this._window.close();
      delete this._window;
    }

    delete this._windowPropertiesToDestroy;
    delete global.navigator;
    delete global.CanvasRenderingContext2D;
  }
}
module.exports = ChartjsNode;
