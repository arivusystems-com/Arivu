function classifyCommunicationFailure(errorLike) {
  const message = String(errorLike || '').toLowerCase();
  if (!message) return 'unknown_error';

  if (message.includes('attachment') || message.includes('enoent')) return 'attachment_error';
  if (
    message.includes('auth') ||
    message.includes('invalid login') ||
    /\b535\b/.test(message) ||
    message.includes('eauth') ||
    message.includes('authentication')
  ) {
    return 'auth_error';
  }
  if (message.includes('not configured') || message.includes('missing') || message.includes('configuration')) return 'config_error';
  if (message.includes('reply_to') || message.includes('reply-to') || message.includes('reply to')) return 'config_error';
  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('econnection') ||
    message.includes('enotfound') ||
    message.includes('eai_again') ||
    message.includes('network') ||
    message.includes('socket') ||
    message.includes('certificate') ||
    message.includes('tls') ||
    message.includes('ssl')
  ) {
    return 'network_error';
  }
  if (message.includes('rejected') || message.includes('bounce') || message.includes('invalid recipient')) {
    return 'provider_rejected';
  }
  return 'unknown_error';
}

module.exports = {
  classifyCommunicationFailure
};
