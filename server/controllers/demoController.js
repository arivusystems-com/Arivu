const DemoRequest = require('../models/DemoRequest');
const Organization = require('../models/Organization');
const UserDirectory = require('../models/UserDirectory');
const InstanceRegistry = require('../models/InstanceRegistry');
const bcrypt = require('bcrypt');
const { buildVerticalProvisionPreview } = require('../services/verticalPresetService');
const { provisionDemoTenant } = require('../services/demoProvisionService');
const { sendDemoTrialContinueEmail } = require('../services/userAccountEmailService');
const {
  issueVerificationToken,
  issueSetupToken,
  sendVerificationEmailForDemoRequest,
  confirmEmailVerification,
  findDemoRequestBySetupToken,
  listVerticalOptionsWithPreview,
  getVerticalPreview,
  resendVerificationForEmail,
  clearSetupToken,
  serializeDemoSetupSession,
  dispatchTrialEmailInBackground,
  ACTIVE_SETUP_STATUSES,
} = require('../services/demoTrialService');
const { buildAuthSessionPayload } = require('../services/authSessionService');
const { VERTICAL_LABELS } = require('../constants/verticalCatalog');
const { validateInternationalPhone } = require('../utils/phoneValidation');
const { validateWorkEmail } = require('../utils/emailValidation');

// --- Submit Demo Request (Public) ---
exports.submitDemoRequest = async (req, res) => {
    const { companyName, contactName, email, phone } = req.body;
    
    try {
        console.log('📝 Demo request received from:', email);
        
        const normalizedEmail = String(email || '').toLowerCase().trim();
        const emailValidation = validateWorkEmail(normalizedEmail);
        if (!emailValidation.ok) {
            return res.status(400).json({
                success: false,
                message: emailValidation.message,
                code: 'INVALID_EMAIL',
            });
        }
        const validatedEmail = emailValidation.email;

        const normalizedPhoneInput = String(phone || '').trim();
        const normalizedContactName = String(contactName || '').trim();
        const normalizedCompanyName = String(companyName || '').trim();

        if (!normalizedCompanyName || !normalizedContactName || !normalizedPhoneInput) {
            return res.status(400).json({ 
                success: false,
                message: 'Please provide full name, work email, phone number, and company name.' 
            });
        }

        const phoneValidation = validateInternationalPhone(normalizedPhoneInput);
        if (!phoneValidation.ok) {
            return res.status(400).json({
                success: false,
                message: phoneValidation.message,
                code: 'INVALID_PHONE',
            });
        }
        const normalizedPhone = phoneValidation.phone;

        const existingDirectoryUser = await UserDirectory.findOne({ email: validatedEmail })
            .select('_id status')
            .lean();
        if (existingDirectoryUser) {
            return res.status(409).json({
                success: false,
                code: 'EXISTING_USER',
                message: 'This email is already linked to an account. Sign in to continue.'
            });
        }
        
        let demoRequest = await DemoRequest.findOne({ email: validatedEmail });
        let isResend = false;
        if (demoRequest) {
            if (demoRequest.status === 'converted') {
                return res.status(409).json({
                    success: false,
                    code: 'DEMO_EXISTS',
                    message: 'A workspace for this email already exists. Sign in to continue.'
                });
            }

            if (!ACTIVE_SETUP_STATUSES.has(demoRequest.status)) {
                return res.status(409).json({
                    success: false,
                    code: 'DEMO_EXISTS',
                    message: 'A demo request with this email already exists. We will contact you soon!'
                });
            }

            demoRequest.companyName = normalizedCompanyName;
            demoRequest.contactName = normalizedContactName;
            demoRequest.phone = normalizedPhone;
            demoRequest.status = demoRequest.status === 'pending' ? 'pending_verification' : demoRequest.status;
            isResend = true;
        } else {
            demoRequest = await DemoRequest.create({
                companyName: normalizedCompanyName,
                industry: '',
                contactName: normalizedContactName,
                email: validatedEmail,
                phone: normalizedPhone,
                status: 'pending_verification',
                source: 'website',
                organizationId: null
            });
        }

        if (demoRequest.status === 'email_verified') {
            const setupTokenRaw = await issueSetupToken(demoRequest);
            dispatchTrialEmailInBackground(
                sendDemoTrialContinueEmail({
                    to: demoRequest.email,
                    contactName: demoRequest.contactName,
                    companyName: demoRequest.companyName,
                    setupToken: setupTokenRaw,
                }),
                'continue-setup-email'
            );
        } else {
            const rawToken = await issueVerificationToken(demoRequest);
            dispatchTrialEmailInBackground(
                sendVerificationEmailForDemoRequest(demoRequest, rawToken),
                'verification-email'
            );
        }

        console.log('✅ Demo request saved:', demoRequest._id);

        res.status(isResend ? 200 : 201).json({
            success: true,
            message: demoRequest.status === 'email_verified'
                ? 'Check your email to continue workspace setup.'
                : 'Check your email to verify and continue workspace setup.',
            requestId: demoRequest._id,
        });
        
    } catch (error) {
        console.error('❌ Demo request error:', error.message);
        res.status(500).json({ 
            success: false,
            message: 'Error submitting demo request. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.verifyDemoEmail = async (req, res) => {
    try {
        const token = String(req.query.token || req.body?.token || '').trim();
        if (!token) {
            return res.status(400).json({ success: false, message: 'Verification token is required.' });
        }

        const result = await confirmEmailVerification(token);
        if (!result.ok) {
            return res.status(400).json({
                success: false,
                code: result.code,
                message: result.message,
            });
        }

        return res.json({
            success: true,
            setupToken: result.setupToken,
            session: result.session,
        });
    } catch (error) {
        console.error('Error verifying demo email:', error);
        return res.status(500).json({ success: false, message: 'Server error verifying email.' });
    }
};

exports.resendDemoVerification = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim();
        const result = await resendVerificationForEmail(email);
        if (!result.ok) {
            const status = result.code === 'NOT_FOUND' ? 404 : 400;
            return res.status(status).json({
                success: false,
                code: result.code,
                message: result.message,
            });
        }

        return res.json({
            success: true,
            message: result.continueSetup
                ? 'Check your email to continue workspace setup.'
                : 'Check your email to verify and continue workspace setup.',
        });
    } catch (error) {
        console.error('Error resending demo verification:', error);
        return res.status(500).json({ success: false, message: 'Server error resending verification email.' });
    }
};

exports.getDemoSetupSession = async (req, res) => {
    try {
        const setupToken = String(req.query.token || req.headers['x-demo-setup-token'] || '').trim();
        if (!setupToken) {
            return res.status(400).json({ success: false, message: 'Setup token is required.' });
        }

        const resolved = await findDemoRequestBySetupToken(setupToken);
        if (!resolved.ok) {
            return res.status(400).json({
                success: false,
                code: resolved.code,
                message: resolved.message,
            });
        }

        return res.json({
            success: true,
            session: serializeDemoSetupSession(resolved.demoRequest),
            verticals: listVerticalOptionsWithPreview(),
        });
    } catch (error) {
        console.error('Error loading demo setup session:', error);
        return res.status(500).json({ success: false, message: 'Server error loading setup session.' });
    }
};

exports.getDemoVerticalPreview = async (req, res) => {
    try {
        const industry = String(req.query.industry || '').trim();
        if (!industry || !VERTICAL_LABELS.includes(industry)) {
            return res.status(400).json({ success: false, message: 'Valid industry is required.' });
        }

        return res.json({
            success: true,
            data: getVerticalPreview(industry),
        });
    } catch (error) {
        console.error('Error loading vertical preview:', error);
        return res.status(500).json({ success: false, message: 'Server error loading preview.' });
    }
};

exports.completeDemoSetup = async (req, res) => {
    try {
        const setupToken = String(req.headers['x-demo-setup-token'] || req.body?.setupToken || '').trim();
        const industry = String(req.body?.industry || '').trim();
        const workspaceName = String(req.body?.workspaceName || '').trim();
        const password = String(req.body?.password || '');

        if (!setupToken || !industry || !workspaceName || !password) {
            return res.status(400).json({
                success: false,
                message: 'Setup token, industry, workspace name, and password are required.',
            });
        }

        if (!VERTICAL_LABELS.includes(industry)) {
            return res.status(400).json({ success: false, message: 'Invalid industry selection.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        const resolved = await findDemoRequestBySetupToken(setupToken);
        if (!resolved.ok) {
            return res.status(400).json({
                success: false,
                code: resolved.code,
                message: resolved.message,
            });
        }

        const provisioned = await provisionDemoTenant({
            demoRequest: resolved.demoRequest,
            industry,
            workspaceName,
            ownerPassword: password,
            actorUserId: null,
            masterOrganizationId: null,
            subscriptionTier: 'trial',
            sendActivationEmail: false,
        });

        await clearSetupToken(provisioned.demoRequest);

        const tenantOrganization = await Organization.findById(provisioned.tenantOrganization._id);
        const userPayload = await buildAuthSessionPayload(provisioned.ownerUser, tenantOrganization, {
            markLogin: true,
            sessionMeta: {
                ip: req.ip,
                userAgent: req.get('user-agent') || '',
                source: 'demo_trial_setup',
            },
        });

        // Prefer provisioned instance — resolveInstanceForLogin can lag on first setup.
        const instance = userPayload.instance?.subdomain
            ? userPayload.instance
            : (provisioned.instance
                ? {
                    subdomain: provisioned.instance.subdomain || null,
                    frontendUrl: provisioned.instance.urls?.frontend || null,
                    apiUrl: provisioned.instance.urls?.api || null,
                    status: provisioned.instance.status || null,
                }
                : null);
        if (instance) {
            userPayload.instance = instance;
        }

        return res.status(201).json({
            success: true,
            message: 'Workspace ready',
            user: userPayload,
            instance,
            verticalTemplate: {
                key: provisioned.verticalTemplate.key,
                primaryAppKey: provisioned.verticalTemplate.primaryAppKey,
                industry,
            },
        });
    } catch (error) {
        console.error('Error completing demo setup:', error);
        const isDev = process.env.NODE_ENV === 'development';
        const rawMessage = error?.message || '';
        const userMessage = rawMessage.includes('validation failed') || rawMessage.includes('Mongo')
            ? 'Could not set up your workspace. Please try again.'
            : (rawMessage || 'Error setting up workspace.');
        return res.status(500).json({
            success: false,
            message: userMessage,
            ...(isDev ? { error: rawMessage } : {}),
        });
    }
};

// --- Get All Demo Requests (Admin Only) ---
exports.getDemoRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        
        const requests = await DemoRequest.find(query)
            .sort({ createdAt: -1 })
            .populate('assignedTo', 'username email firstName lastName')
            .populate('organizationId', 'name industry')
            .populate('contactId', 'first_name last_name email phone lifecycle_stage')
            .populate('convertedToInstanceId', 'instanceName subdomain status');
        
        res.json({
            success: true,
            count: requests.length,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching demo requests:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching demo requests' 
        });
    }
};

// --- Get Single Demo Request ---
exports.getDemoRequest = async (req, res) => {
    try {
        const request = await DemoRequest.findById(req.params.id)
            .populate('assignedTo', 'username email firstName lastName')
            .populate('organizationId', 'name industry subscription')
            .populate('contactId', 'first_name last_name email phone job_title lifecycle_stage lead_score')
            .populate('convertedToInstanceId', 'instanceName subdomain status urls');
        
        if (!request) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error fetching demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// --- Update Demo Request Status ---
exports.updateDemoRequest = async (req, res) => {
    try {
        const { status, notes, assignedTo, preferredDemoDate } = req.body;
        
        const updateData = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        if (preferredDemoDate) updateData.preferredDemoDate = preferredDemoDate;
        
        const demoRequest = await DemoRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'username email');
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        console.log('✅ Demo request updated:', demoRequest._id, '- Status:', demoRequest.status);
        
        res.json({
            success: true,
            data: demoRequest,
            message: 'Demo request updated successfully'
        });
    } catch (error) {
        console.error('Error updating demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating demo request' 
        });
    }
};

// --- Preview demo conversion (vertical provisioning) ---
exports.previewDemoConversion = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findById(req.params.id).select('industry companyName').lean();
        if (!demoRequest) {
            return res.status(404).json({ success: false, message: 'Demo request not found' });
        }

        const industryOverride = String(req.query.industryOverride || req.body?.industryOverride || '').trim();
        const industry = industryOverride || demoRequest.industry || '';
        const preview = buildVerticalProvisionPreview(industry);

        res.json({
            success: true,
            data: {
                ...preview,
                companyName: demoRequest.companyName,
            },
        });
    } catch (error) {
        console.error('Error previewing demo conversion:', error);
        res.status(500).json({ success: false, message: 'Server error previewing conversion' });
    }
};

// --- Convert Demo Request to Instance (Multi-Instance Architecture) ---
exports.convertToOrganization = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findById(req.params.id);
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        if (demoRequest.status === 'converted') {
            return res.status(400).json({ 
                success: false,
                message: 'This demo request has already been converted' 
            });
        }

        const { subscriptionTier = 'trial', industryOverride } = req.body;

        if (industryOverride && String(industryOverride).trim()) {
            demoRequest.industry = String(industryOverride).trim();
            await demoRequest.save();
        }

        if (!String(demoRequest.industry || '').trim()) {
            return res.status(400).json({
                success: false,
                message: 'Industry is required. Provide industryOverride for requests without a selected industry.',
                code: 'INDUSTRY_REQUIRED',
            });
        }

        const provisioned = await provisionDemoTenant({
            demoRequest,
            industry: demoRequest.industry,
            workspaceName: demoRequest.companyName,
            ownerPassword: null,
            actorUserId: req.user?._id || null,
            masterOrganizationId: req.user?.organizationId || null,
            subscriptionTier: subscriptionTier,
            sendActivationEmail: true,
        });

        const responseData = {
            demoRequestId: provisioned.demoRequest._id,
            organizationId: provisioned.demoRequest.organizationId,
            tenantOrganizationId: provisioned.tenantOrganization._id,
            databaseName: provisioned.dbName,
            subdomain: provisioned.instance?.subdomain || null,
            status: 'converted',
            ownerEmail: provisioned.demoRequest.email.toLowerCase(),
            activationEmailSent: provisioned.activationEmailSent,
            verticalTemplate: {
                key: provisioned.verticalTemplate.key,
                primaryAppKey: provisioned.verticalTemplate.primaryAppKey,
                industry: provisioned.demoRequest.industry,
            },
            note: provisioned.activationEmailSent
                ? 'Activation email sent. Owner must activate their workspace before signing in.'
                : 'Workspace provisioned. Activation email was not sent — use Resend activation or share the activation link.'
        };
        if (!provisioned.activationEmailSent && provisioned.activationUrl) {
            responseData.activationUrl = provisioned.activationUrl;
            responseData.activationEmailReason = provisioned.activationEmailReason || null;
        }

        res.json({
            success: true,
            message: provisioned.activationEmailSent
                ? 'Organization converted. Activation email sent to the demo contact.'
                : 'Organization converted. Activation email could not be sent.',
            data: responseData
        });
        
    } catch (error) {
        console.error('❌ Conversion error:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // Return detailed error in development
        const errorResponse = {
            success: false,
            message: 'Error converting demo request',
            error: error.message,
            stack: error.stack,
            name: error.name
        };
        
        // Add additional error details if available
        if (error.code) errorResponse.code = error.code;
        if (error.keyPattern) errorResponse.keyPattern = error.keyPattern;
        if (error.keyValue) errorResponse.keyValue = error.keyValue;
        
        res.status(500).json(errorResponse);
    }
};


// --- Resend demo workspace activation email ---
exports.resendDemoActivation = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findById(req.params.id);
        if (!demoRequest) {
            return res.status(404).json({
                success: false,
                message: 'Demo request not found'
            });
        }
        if (demoRequest.status !== 'converted') {
            return res.status(400).json({
                success: false,
                message: 'Only converted demo requests can resend activation',
                code: 'NOT_CONVERTED'
            });
        }

        let tenantOrganization = await Organization.findOne({
            legacyOrganizationId: demoRequest.organizationId,
            isTenant: true
        });
        if (!tenantOrganization && demoRequest.convertedToInstanceId) {
            const instance = await InstanceRegistry.findById(demoRequest.convertedToInstanceId).lean();
            if (instance?.databaseConnection?.database) {
                tenantOrganization = await Organization.findOne({
                    'database.name': instance.databaseConnection.database,
                    isTenant: true
                });
            }
        }
        if (!tenantOrganization?.database?.name || !tenantOrganization.database.initialized) {
            return res.status(400).json({
                success: false,
                message: 'Converted tenant workspace is not ready',
                code: 'TENANT_NOT_READY'
            });
        }

        const userInviteService = require('../services/userInviteService');
        const { buildInviteUrl } = require('../utils/userAuthTokens');
        const ScopedUser = await userInviteService.getScopedUserModel(tenantOrganization);
        const ownerEmail = String(demoRequest.email || '').toLowerCase().trim();
        const ownerUser = await ScopedUser.findOne({ email: ownerEmail, isOwner: true });
        if (!ownerUser) {
            return res.status(404).json({
                success: false,
                message: 'Owner user not found for converted demo',
                code: 'OWNER_NOT_FOUND'
            });
        }
        if (ownerUser.status === 'active' && ownerUser.inviteAcceptedAt) {
            return res.status(400).json({
                success: false,
                message: 'Owner has already activated their workspace',
                code: 'ALREADY_ACTIVATED'
            });
        }

        const inviteCredentials = userInviteService.buildInviteCredentials({});
        const inviteTokenHash = userInviteService.hashToken(inviteCredentials.inviteTokenRaw);
        ownerUser.password = await bcrypt.hash(inviteCredentials.password, 10);
        ownerUser.status = inviteCredentials.initialStatus;
        ownerUser.mustChangePassword = false;
        ownerUser.invitedAt = new Date();
        ownerUser.invitedBy = req.user?._id || ownerUser.invitedBy || null;
        ownerUser.inviteAcceptedAt = null;
        ownerUser.emailVerifiedAt = null;
        ownerUser.inviteTokenHash = inviteTokenHash;
        ownerUser.inviteTokenExpiresAt = inviteCredentials.inviteTokenExpiresAt;
        ownerUser.emailVerificationTokenHash = null;
        ownerUser.emailVerificationExpiresAt = null;
        ownerUser.emailVerificationSentAt = null;
        await ownerUser.save();

        await UserDirectory.findOneAndUpdate(
            { email: ownerEmail },
            {
                $set: {
                    organizationId: tenantOrganization._id,
                    tenantDatabaseName: tenantOrganization.database.name,
                    tenantUserId: ownerUser._id,
                    status: 'active',
                    inviteTokenHash,
                    emailVerificationTokenHash: null
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const activationEmailResult = await userInviteService.sendDemoWorkspaceActivationForUser({
            user: ownerUser,
            organization: tenantOrganization,
            inviteToken: inviteCredentials.inviteTokenRaw
        });

        const responseData = {
            ownerEmail,
            activationEmailSent: activationEmailResult.sent === true
        };
        if (!activationEmailResult.sent) {
            responseData.activationUrl = buildInviteUrl(inviteCredentials.inviteTokenRaw);
            responseData.activationEmailReason = activationEmailResult.reason || null;
        }

        return res.json({
            success: true,
            message: activationEmailResult.sent
                ? 'Activation email resent'
                : 'Activation link reissued; email could not be sent',
            data: responseData
        });
    } catch (error) {
        console.error('[demoController] resendDemoActivation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error resending activation email',
            error: error.message
        });
    }
};

// --- Delete Demo Request ---
exports.deleteDemoRequest = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findByIdAndDelete(req.params.id);
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        console.log('🗑️ Demo request deleted:', demoRequest.email);
        
        res.json({
            success: true,
            message: 'Demo request deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// --- Get Demo Request Statistics ---
exports.getStats = async (req, res) => {
    try {
        const stats = await DemoRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const total = await DemoRequest.countDocuments();
        const thisMonth = await DemoRequest.countDocuments({
            createdAt: { $gte: new Date(new Date().setDate(1)) }
        });
        
        res.json({
            success: true,
            data: {
                total,
                thisMonth,
                byStatus: stats.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

