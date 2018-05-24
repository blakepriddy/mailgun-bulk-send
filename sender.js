'use strict';

const config = require('./load_config'),
    logger = require('./logger'),
    fs = require('fs'),
    path = require('path'),
    csv_parse = require('csv-parse'),
    _ = require('underscore');

function loadCSV(filename) {
  return new Promise((resolve, reject) => {
    const csvData = [];
    fs.createReadStream(path.resolve(__dirname, filename)).
      pipe(csv_parse({
        columns: true, // autodiscover
        delimiter: config.csv_delimiter,
      })).on('data', function(csvrow) {
        csvData.push(csvrow);
      }).on('end', function() {
        resolve(csvData);
      });
  });
}

function readFile(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, filename), 'utf8', (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

function validatePayload(payload) {
  return new Promise((resolve, reject) => {
    logger.info('Looking for empty data');
    if (!payload.csv.length) return reject('CSV is empty');
    if (!payload.subject) return reject('Subject is required');
    if (!payload.text) return reject('Text email body is required');
    if (!payload.html) return reject('HTML email body is required');
    // quick validation that html contains at least one recipient variable
    /*
    if (payload.html.indexOf('%recipient.') == -1) {
      return reject('
        HTML %recipient.x% variables are required for batch sending');
    }
    if (payload.text.indexOf('%recipient.') == -1) {
      return reject('
        Text %recipient.x% variables are required for batch sending');
    }
    */
    logger.info('Validating CSV file contents');
    var user_keys = _.keys(payload.csv[0]);
    logger.info('Found user keys: ' + user_keys.join(','));
    if (!_.contains(user_keys, 'email')) {
      return reject('"email" column is required in CSV file');
    }
    if (user_keys.length == 1) {
      return reject('Unique id and other variables are required in CSV');
    }
    // look for recipient variable in html and text
    let missing = _.filter(
      (payload.html + payload.text).match(/%recipient.(.*?)%/g),
      (variable) => {
        variable = variable.replace('%recipient.', '').replace('%', '');
        return !_.contains(user_keys, variable);
      });
    if (missing.length) {
      reject('Recipient variables are missing from CSV: ' + missing.join(', '));
    }
    resolve(payload);
  });
}

function bulkSend(payload) {
  return new Promise((resolve, reject) => {
    resolve();
  });
}

module.exports = (SETUP) => {
  const payload = {};
  logger.info(`Reading CSV from: ${SETUP.csv}`);
  loadCSV(SETUP.csv).then((csv) => {
    payload.csv = csv;
    logger.info(`Reading Subject from: ${SETUP.subject}`);
    return readFile(SETUP.subject);
  }).then((subject) => {
    payload.subject = subject;
    logger.info(`Reading HTML from: ${SETUP.html}`);
    return readFile(SETUP.html);
  }).then((html) => {
    payload.html = html;
    logger.info(`Reading Text from: ${SETUP.text}`);
    return readFile(SETUP.text);
  }).then((text) => {
    payload.text = text;
    return validatePayload(payload);
  }).then(() => {
    return bulkSend(payload);
  }).then((results) => {
    logger.info('Success!');
    logger.info(results);
  }).catch((err) => {
    logger.error(err);
  });
};