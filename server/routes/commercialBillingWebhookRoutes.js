'use strict';

const express = require('express');
const { postCommercialRazorpayWebhook } = require('../controllers/commercialBillingController');

const router = express.Router();

router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  postCommercialRazorpayWebhook
);

module.exports = router;
