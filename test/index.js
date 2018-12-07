/* globals describe, it*/
'use strict';
const debug = require('debug')('chartjs-node:test');
const assert = require('assert');
const ChartjsNode = require('../index.js');
const fs = require('fs');
const stream = require('stream');
const chartOptions = require('./chartOptions');
/**
 * Schedule compute test. Tests a variety of schedules to validate correctness
 */
describe('chartjs', function() {
  function runScenarios(chartConfig) {
    describe('#destroy', function() {
      it('should destroy the in-memory window', function() {
        const chartNode = new ChartjsNode(600, 600);
        return chartNode.drawChart(chartConfig)
            .then(() => {
              chartNode.destroy();
              // check if there are window properties to destroy from node global object
              assert(!chartNode._windowPropertiesToDestroy);
              assert(!chartNode._window);
              debug('Sucessfully destroyed in-memory window properties');
            });
      });
    });
    describe('#drawChart', function() {
      it('should draw the chart to a file', function() {
        const chartNode = new ChartjsNode(940, 250);
        return chartNode.drawChart(chartConfig)
            .then(() => {
              assert.ok(chartNode);
              return chartNode.writeImageToFile('image/png', './testimagesadsadsa.png');
            })
            .then(() => {
              assert(fs.existsSync('./testimagesadsadsa.png'));
              debug('Sucessfully wrote image to a file');
            });
      });
      it('should draw the chart to a buffer', function() {
        const chartNode = new ChartjsNode(600, 600);
        return chartNode.drawChart(chartConfig)
            .then(() => {
              assert.ok(chartNode);
              return chartNode.getImageBuffer('image/png');
            })
            .then((buffer) => {
              assert(buffer.length > 1);
              assert(buffer instanceof Buffer);
              debug('Sucessfully wrote image to a Buffer');
            });
      });
      it('should draw the chart to a stream', function() {
        const chartNode = new ChartjsNode(600, 600);
        return chartNode.drawChart(chartConfig)
            .then(() => {
              assert.ok(chartNode);
              return chartNode.getImageStream('image/png');
            })
            .then((imageStream) => {
              assert(imageStream.stream instanceof stream.Readable);
              const length = imageStream.length;
              let readLength = 0;
              return new Promise((resolve, reject) => {
                imageStream.stream.on('data', (data) => {
                  readLength += data.length;
                  if (readLength === length) {
                    debug('Sucessfully wrote image to a Readable stream');
                    resolve();
                  }
                });
                setTimeout(() => {
                  debug('length: ' + length);
                  debug('readLength: ' + readLength);
                  reject('Failed to read complete chart image stream in time');
                }, 1000);
              });
            });
      });
      it('should return the image as data url', function() {
        const chartNode = new ChartjsNode(600, 600);
        return chartNode.drawChart(chartConfig)
            .then(() => {
              assert.ok(chartNode);
              return chartNode.getImageDataUrl('image/png');
            })
            .then((imageData) => {
              assert(imageData.length > 1);
              debug('Sucessfully wrote image to a Readable stream');
            });
      });
    });
    describe('beforeDraw event', function() {
      it('should provide a reference to global Chartjs instance', function() {
        let Chartjs = null;
        const chartNode = new ChartjsNode(600, 600);
        chartNode.on('beforeDraw', function(chart) {
          Chartjs = chart;
        });
        return chartNode.drawChart(chartConfig)
            .then(() => {
              assert.ok(Chartjs);
              chartNode.destroy();
              debug('Sucessfully emitted beforeDraw event');
            });
      });
    });
  }


  describe('with charts but no plugins,', function() {
    runScenarios(chartOptions);
  });
});
