const InstanceRegistry = require('../../models/InstanceRegistry');
const { acquireSchedulerLock } = require('../../lib/schedulerLock');
const mongoose = require('mongoose');

/**
 * Metrics Collector Service
 * Collects and aggregates metrics from customer instances
 * This would typically connect to each instance's database to fetch real metrics
 */
class MetricsCollector {
    constructor() {
        this.collectionInterval = 15 * 60 * 1000; // 15 minutes
        this.isRunning = false;
        this.intervalId = null;
    }

    /**
     * Start the metrics collection service
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Metrics collector is already running');
            return;
        }

        console.log('📊 Starting metrics collector service...');
        this.isRunning = true;

        // Run immediately
        this.collectAllMetrics();

        // Then run periodically
        this.intervalId = setInterval(() => {
            this.collectAllMetrics();
        }, this.collectionInterval);

        console.log(`✅ Metrics collector started (interval: ${this.collectionInterval / 1000}s)`);
    }

    /**
     * Stop the metrics collection service
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Metrics collector is not running');
            return;
        }

        console.log('🛑 Stopping metrics collector service...');
        clearInterval(this.intervalId);
        this.isRunning = false;
        console.log('✅ Metrics collector stopped');
    }

    /**
     * Collect metrics from all active instances
     */
    async collectAllMetrics() {
        try {
            const acquired = await acquireSchedulerLock('metrics-collector', 14 * 60 * 1000);
            if (!acquired) return;

            console.log('📈 Collecting metrics from all active instances...');

            const instances = await InstanceRegistry.find({
                status: 'active'
            });

            if (instances.length === 0) {
                console.log('ℹ️  No active instances to collect metrics from');
                return;
            }

            console.log(`📊 Collecting metrics from ${instances.length} instances...`);

            const collectionPromises = instances.map(instance =>
                this.collectInstanceMetrics(instance)
                    .catch(error => {
                        console.error(`❌ Error collecting metrics for ${instance.subdomain}:`, error.message);
                        return null;
                    })
            );

            const results = await Promise.all(collectionPromises);

            const successCount = results.filter(r => r !== null).length;
            console.log(`✅ Metrics collection complete. ${successCount}/${instances.length} successful`);
        } catch (error) {
            console.error('❌ Error in collectAllMetrics:', error);
        }
    }

    /**
     * Collect metrics from a single instance
     * @param {Object} instance - Instance document from InstanceRegistry
     */
    async collectInstanceMetrics(instance) {
        try {
            // In a real implementation, this would connect to the instance's database
            // or API to fetch actual metrics. For now, we'll simulate it.

            const metrics = await this.fetchMetricsFromInstance(instance);

            // Update instance metrics
            instance.metrics = {
                ...instance.metrics,
                ...metrics,
                lastCollected: new Date()
            };

            await instance.save();

            console.log(`✓ Collected metrics for ${instance.subdomain}`);

            return {
                instanceId: instance._id,
                subdomain: instance.subdomain,
                metrics
            };
        } catch (error) {
            console.error(`❌ Error collecting metrics for ${instance.subdomain}:`, error.message);
            throw error;
        }
    }

    /**
     * Fetch metrics from instance database or API
     * @param {Object} instance - Instance document
     */
    async fetchMetricsFromInstance(instance) {
        try {
            // In production, connect to the instance's MongoDB to query actual data
            // For now, we'll return simulated metrics

            // Example: Connect to instance DB
            // const instanceDb = await mongoose.createConnection(instance.databaseConnection.connectionString);
            // const User = instanceDb.model('User', UserSchema);
            // const totalUsers = await User.countDocuments();

            // Simulated metrics (replace with actual database queries)
            const metrics = {
                totalUsers: Math.floor(Math.random() * 50) + 1,
                totalContacts: Math.floor(Math.random() * 500) + 10,
                totalDeals: Math.floor(Math.random() * 200) + 5,
                storageUsedGB: parseFloat((Math.random() * 5).toFixed(2)),
                apiCallsThisMonth: Math.floor(Math.random() * 10000) + 100
            };

            return metrics;
        } catch (error) {
            console.error(`Error fetching metrics from ${instance.subdomain}:`, error);
            throw error;
        }
    }

    /**
     * Collect metrics for a specific instance by ID
     * @param {String} instanceId - Instance ID
     */
    async collectMetricsById(instanceId) {
        try {
            const instance = await InstanceRegistry.findById(instanceId);

            if (!instance) {
                throw new Error('Instance not found');
            }

            return await this.collectInstanceMetrics(instance);
        } catch (error) {
            console.error(`Error collecting metrics for instance ${instanceId}:`, error);
            throw error;
        }
    }

    /**
     * Get aggregated metrics across all instances
     */
    async getAggregatedMetrics() {
        try {
            const aggregatedMetrics = await InstanceRegistry.aggregate([
                {
                    $match: { status: 'active' }
                },
                {
                    $group: {
                        _id: null,
                        totalInstances: { $sum: 1 },
                        totalUsers: { $sum: '$metrics.totalUsers' },
                        totalContacts: { $sum: '$metrics.totalContacts' },
                        totalDeals: { $sum: '$metrics.totalDeals' },
                        totalStorageGB: { $sum: '$metrics.storageUsedGB' },
                        totalApiCalls: { $sum: '$metrics.apiCallsThisMonth' },
                        totalMRR: { $sum: '$subscription.mrr' }
                    }
                }
            ]);

            return aggregatedMetrics[0] || {
                totalInstances: 0,
                totalUsers: 0,
                totalContacts: 0,
                totalDeals: 0,
                totalStorageGB: 0,
                totalApiCalls: 0,
                totalMRR: 0
            };
        } catch (error) {
            console.error('Error getting aggregated metrics:', error);
            throw error;
        }
    }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

module.exports = metricsCollector;

