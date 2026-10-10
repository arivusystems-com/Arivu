'use strict';

const { randomBytes } = require('crypto');

function generateManageToken() {
  return randomBytes(24).toString('base64url');
}

function buildManageUrl(token) {
  const { resolveClientUrl } = require('./clientUrl');
  const base = resolveClientUrl();
  return `${base}/appointments/manage/${token}`;
}

module.exports = {
  generateManageToken,
  buildManageUrl
};
