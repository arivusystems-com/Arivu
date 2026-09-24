const express = require('express');
const {
    registerUser,
    loginUser,
    continueLogin,
    listAuthSessions,
    revokeAuthSession,
    logoutUser
} = require('../controllers/authController');
const {
    getGoogleLoginStatus,
    startGoogleLogin,
    handleGoogleLoginCallback
} = require('../controllers/googleLoginAuthController');
const {
    validateInvite,
    acceptInvite,
    confirmEmailVerification
} = require('../controllers/userInviteAuthController');
const {
    forgotPassword,
    validateResetPassword,
    resetPassword
} = require('../controllers/passwordResetAuthController');
const { 
    authLimiter, 
    registrationLimiter, 
    passwordResetLimiter,
    authTokenActionLimiter
} = require('../middleware/rateLimitMiddleware');
const { progressiveAuthThrottle } = require('../middleware/progressiveAuthThrottleMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { optionalAuth } = require('../middleware/optionalAuthMiddleware');
const {
    selectPortal,
    switchPortal,
    setDefaultExternalRole,
    listPortals
} = require('../controllers/portalAuthController');
const router = express.Router();

// Test endpoint to verify code version
router.get('/test-version', (req, res) => {
    res.json({
        message: '✅ NEW CODE IS RUNNING',
        timestamp: new Date().toISOString(),
        version: 'v2-with-organizations'
    });
});

// Apply strict rate limiting to authentication endpoints
router.post('/register', registrationLimiter, registerUser);
router.post('/login', progressiveAuthThrottle, authLimiter, loginUser);
router.post('/login/continue', progressiveAuthThrottle, authLimiter, continueLogin);

router.get('/google/status', authLimiter, getGoogleLoginStatus);
router.get('/google', progressiveAuthThrottle, authLimiter, startGoogleLogin);
router.get('/google/callback', progressiveAuthThrottle, authLimiter, handleGoogleLoginCallback);

router.get('/sessions', optionalAuth, authLimiter, listAuthSessions);
router.delete('/sessions/:sessionId', optionalAuth, authLimiter, revokeAuthSession);
router.post('/logout', protect, logoutUser);

router.get('/invite/validate', authTokenActionLimiter, validateInvite);
router.post('/invite/accept', authTokenActionLimiter, acceptInvite);
router.get('/verify-email/confirm', authTokenActionLimiter, confirmEmailVerification);
router.post('/verify-email/confirm', authTokenActionLimiter, confirmEmailVerification);

router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.get('/reset-password/validate', authTokenActionLimiter, validateResetPassword);
router.post('/reset-password', authTokenActionLimiter, resetPassword);

router.get('/portal/list', protect, listPortals);
router.post('/portal/select', protect, selectPortal);
router.post('/portal/switch', protect, switchPortal);
router.patch('/portal/default-role', protect, setDefaultExternalRole);

module.exports = router;
