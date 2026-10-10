const InstanceRegistry = require('../../models/InstanceRegistry');
const { acquireSchedulerLock } = require('../../lib/schedulerLock');
const axios = require('axios');
const { buildTenantFrontendUrl, buildTenantApiUrl } = require('../../utils/tenantDomain');

/**
 * Health Checker Service
 * Periodically checks the health of all active customer instances
 * and updates their health status in the InstanceRegistry
 */
class HealthChecker {
    constructor() {
        this.checkInterval = 5 * 60 * 1000; // 5 minutes
        this.timeout = 10000; // 10 seconds timeout for health checks
        this.isRunning = false;
        this.intervalId = null;
    }

    /**
     * Start the health checking service
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Health checker is already running');
            return;
        }

        console.log('🏥 Starting health checker service...');
        this.isRunning = true;

        // Run immediately
        this.checkAllInstances();

        // Then run periodically
        this.intervalId = setInterval(() => {
            this.checkAllInstances();
        }, this.checkInterval);

        console.log(`✅ Health checker started (interval: ${this.checkInterval / 1000}s)`);
    }

    /**
     * Stop the health checking service
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Health checker is not running');
            return;
        }

        console.log('🛑 Stopping health checker service...');
        clearInterval(this.intervalId);
        this.isRunning = false;
        console.log('✅ Health checker stopped');
    }

    /**
     * Check health of all active instances
     */
    async checkAllInstances() {
        try {
            const acquired = await acquireSchedulerLock('health-checker', 4 * 60 * 1000);
            if (!acquired) return;

            console.log('🔍 Running health checks on all active instances...');

            // Get all instances that are active or provisioning
            const instances = await InstanceRegistry.find({
                status: { $in: ['active', 'provisioning'] }
            });

            if (instances.length === 0) {
                console.log('ℹ️  No instances to check');
                return;
            }

            console.log(`📊 Checking ${instances.length} instances...`);

            // Check all instances in parallel (but with controlled concurrency)
            const checkPromises = instances.map(instance => 
                this.checkInstanceHealth(instance)
                    .catch(error => {
                        console.error(`❌ Error checking instance ${instance.subdomain}:`, error.message);
                        return null; // Continue with other instances
                    })
            );

            const results = await Promise.all(checkPromises);

            // Log summary
            const summary = results.reduce((acc, result) => {
                if (!result) return acc;
                acc[result.healthStatus] = (acc[result.healthStatus] || 0) + 1;
                return acc;
            }, {});

            console.log('✅ Health check complete. Summary:', summary);
        } catch (error) {
            console.error('❌ Error in checkAllInstances:', error);
        }
    }

    /**
     * Check health of a single instance
     * @param {Object} instance - Instance document from InstanceRegistry
     */
    async checkInstanceHealth(instance) {
        try {
            const startTime = Date.now();

            // Define health check endpoints
            const healthEndpoints = {
                api: `${instance.urls?.api || buildTenantApiUrl(instance.subdomain)}/health`,
                frontend: instance.urls?.frontend || buildTenantFrontendUrl(instance.subdomain)
            };

            // Check API health
            let apiHealth = 'unknown';
            let apiResponseTime = 0;
            
            try {
                const apiResponse = await axios.get(healthEndpoints.api, {
                    timeout: this.timeout,
                    validateStatus: (status) => status < 500 // Accept 4xx but not 5xx
                });
                apiResponseTime = Date.now() - startTime;
                
                if (apiResponse.status === 200) {
                    apiHealth = 'healthy';
                } else {
                    apiHealth = 'degraded';
                }
            } catch (error) {
                if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                    apiHealth = 'degraded'; // Timeout
                } else if (error.response && error.response.status >= 500) {
                    apiHealth = 'unhealthy'; // Server error
                } else {
                    apiHealth = 'unhealthy'; // Connection error
                }
            }

            // Check frontend accessibility
            let frontendHealth = 'unknown';
            
            try {
                const frontendResponse = await axios.get(healthEndpoints.frontend, {
                    timeout: this.timeout,
                    validateStatus: (status) => status < 500
                });
                
                if (frontendResponse.status === 200) {
                    frontendHealth = 'healthy';
                } else {
                    frontendHealth = 'degraded';
                }
            } catch (error) {
                frontendHealth = 'unhealthy';
            }

            // Determine overall health status
            let overallHealth = 'healthy';
            
            if (apiHealth === 'unhealthy' || frontendHealth === 'unhealthy') {
                overallHealth = 'unhealthy';
            } else if (apiHealth === 'degraded' || frontendHealth === 'degraded') {
                overallHealth = 'degraded';
            } else if (apiHealth === 'unknown' || frontendHealth === 'unknown') {
                overallHealth = 'unknown';
            }

            // Fetch metrics from instance (if available)
            let metrics = instance.metrics || {};
            
            try {
                // Try to fetch metrics from the instance's metrics endpoint
                const metricsResponse = await axios.get(`${healthEndpoints.api}/metrics`, {
                    timeout: this.timeout,
                    headers: {
                        'X-Master-Key': process.env.MASTER_API_KEY // For inter-service communication
                    }
                });

                if (metricsResponse.status === 200 && metricsResponse.data) {
                    metrics = {
                        ...metrics,
                        ...metricsResponse.data,
                        lastUpdated: new Date()
                    };
                }
            } catch (error) {
                // Metrics endpoint not available or failed - that's okay
                console.log(`ℹ️  Metrics not available for ${instance.subdomain}`);
            }

            // Update instance in database
            instance.healthStatus = overallHealth;
            instance.lastHealthCheck = new Date();
            instance.metrics = metrics;
            
            await instance.save();

            console.log(`✓ ${instance.subdomain}: ${overallHealth} (API: ${apiResponseTime}ms)`);

            return {
                instanceId: instance._id,
                subdomain: instance.subdomain,
                healthStatus: overallHealth,
                apiHealth,
                frontendHealth,
                apiResponseTime,
                metrics
            };
        } catch (error) {
            console.error(`❌ Error checking ${instance.subdomain}:`, error.message);
            
            // Mark as unhealthy if check fails
            instance.healthStatus = 'unhealthy';
            instance.lastHealthCheck = new Date();
            await instance.save();

            return {
                instanceId: instance._id,
                subdomain: instance.subdomain,
                healthStatus: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Check a specific instance by ID
     * @param {String} instanceId - Instance ID
     */
    async checkInstanceById(instanceId) {
        try {
            const instance = await InstanceRegistry.findById(instanceId);
            
            if (!instance) {
                throw new Error('Instance not found');
            }

            return await this.checkInstanceHealth(instance);
        } catch (error) {
            console.error(`Error checking instance ${instanceId}:`, error);
            throw error;
        }
    }
}

// Singleton instance
const healthChecker = new HealthChecker();

module.exports = healthChecker;

