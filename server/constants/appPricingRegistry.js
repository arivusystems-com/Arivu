/**
 * ============================================================================
 * App Pricing Registry: Billing Configuration
 * ============================================================================
 * 
 * Defines how each app is billed, not how it works.
 * 
 * Billing Types:
 * - PER_USER: Seat-based billing (counts active users with appAccess)
 * - FLAT: Flat-rate billing (no seat limits)
 * 
 * Plans:
 * - BASIC: Entry-level plan
 * - PRO: Professional plan
 * - ENTERPRISE: Enterprise plan (usually unlimited)
 * 
 * ⚠️ IMPORTANT: No billing logic outside this registry
 * 
 * ============================================================================
 */

module.exports = {
    SALES: {
        billingType: 'PER_USER',
        defaultSeatLimit: null, // null = unlimited by default
        defaultPlan: 'BASIC',
        trialDays: 14, // Not used for SALES (already provisioned)
        plans: {
            BASIC: {
                seatLimit: 5
            },
            PRO: {
                seatLimit: 25
            },
            ENTERPRISE: {
                seatLimit: null // null = unlimited
            }
        }
    },

    HELPDESK: {
        billingType: 'PER_USER',
        defaultSeatLimit: null,
        defaultPlan: 'BASIC',
        trialDays: 14,
        plans: {
            BASIC: {
                seatLimit: 5
            },
            PRO: {
                seatLimit: 25
            },
            ENTERPRISE: {
                seatLimit: null
            }
        }
    },

    PROJECTS: {
        billingType: 'PER_USER',
        defaultSeatLimit: null,
        defaultPlan: 'BASIC',
        trialDays: 14,
        plans: {
            BASIC: {
                seatLimit: 5
            },
            PRO: {
                seatLimit: 25
            },
            ENTERPRISE: {
                seatLimit: null
            }
        }
    },

    AUDIT: {
        billingType: 'PER_USER',
        defaultSeatLimit: null,
        defaultPlan: 'BASIC',
        trialDays: 14,
        plans: {
            BASIC: {
                seatLimit: 10
            },
            PRO: {
                seatLimit: 50
            },
            ENTERPRISE: {
                seatLimit: null // null = unlimited
            }
        }
    },

    PORTAL: {
        billingType: 'FLAT',
        defaultSeatLimit: null, // FLAT apps ignore seats
        defaultPlan: 'BASIC',
        trialDays: 30,
        plans: {
            BASIC: {},
            PRO: {},
            ENTERPRISE: {}
        }
    },

    INVENTORY: {
        billingType: 'PER_USER',
        defaultSeatLimit: null,
        defaultPlan: 'BASIC',
        trialDays: 14,
        plans: {
            BASIC: {
                seatLimit: 5
            },
            PRO: {
                seatLimit: 25
            },
            ENTERPRISE: {
                seatLimit: null
            }
        }
    },

    MARKETING: {
        billingType: 'PER_USER',
        defaultSeatLimit: null,
        defaultPlan: 'BASIC',
        trialDays: 14,
        plans: {
            BASIC: {
                seatLimit: 5
            },
            PRO: {
                seatLimit: 25
            },
            ENTERPRISE: {
                seatLimit: null
            }
        }
    },

    /**
     * Learning — commercial model is TIERED_CAPACITY learner seats (learning_app),
     * not PER_USER org-subscription seats. Invite grants appAccess (LEARNER|AUTHOR|ADMIN);
     * billable capacity is enforced at enroll via LearningSeatService.
     * FLAT here = always allow assigning Learning access in invite/edit user flows.
     */
    LMS: {
        billingType: 'FLAT',
        defaultSeatLimit: null,
        defaultPlan: 'BASIC',
        trialDays: 14,
        plans: {
            BASIC: {},
            PRO: {},
            ENTERPRISE: {}
        }
    }
};

