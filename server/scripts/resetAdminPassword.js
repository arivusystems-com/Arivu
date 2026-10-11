#!/usr/bin/env node

/**
 * Reset Admin Password Script
 * Resets the admin user password to a known value
 * 
 * Usage:
 *   node server/scripts/resetAdminPassword.js
 *   node server/scripts/resetAdminPassword.js Admin@123
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;
const ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@arivusystems.com';
const { resolveAdminSeedPassword } = require('../config/validateEnv');

let NEW_PASSWORD;
try {
    NEW_PASSWORD = resolveAdminSeedPassword(process.argv[2]);
} catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
}

async function resetAdminPassword() {
    try {
        console.log('🔐 Resetting Admin Password...\n');
        
        if (!MONGO_URI) {
            console.error('❌ Error: MONGODB_URI is not set in .env file!');
            process.exit(1);
        }
        
        console.log('🔗 Connecting to MongoDB...');
        
        // Connect to master database
        const [uriWithoutQuery, queryPart] = MONGO_URI.split('?');
        const connectionQuery = queryPart ? `?${queryPart}` : '';
        const baseUri = uriWithoutQuery.split('/').slice(0, -1).join('/');
        const masterDbName = 'arivu_master';
        const masterUri = `${baseUri}/${masterDbName}${connectionQuery}`;
        
        await mongoose.connect(masterUri);
        console.log(`✅ Connected to MongoDB master database: ${masterDbName}\n`);
        
        // Find admin user
        const adminUser = await User.findOne({ email: ADMIN_EMAIL });
        
        if (!adminUser) {
            console.error(`❌ Admin user not found: ${ADMIN_EMAIL}`);
            console.log('\n💡 Run: node scripts/createDefaultAdmin.js to create admin user');
            process.exit(1);
        }
        
        console.log(`✅ Found admin user: ${adminUser.email}`);
        console.log(`   Name: ${adminUser.firstName} ${adminUser.lastName}`);
        console.log(`   Organization: ${adminUser.organizationId}\n`);
        
        // Hash new password
        console.log('🔐 Hashing new password...');
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
        
        // Update password
        adminUser.password = hashedPassword;
        await adminUser.save();
        
        console.log('✅ Password reset successfully!');
        console.log(`\n📝 New Credentials:`);
        console.log(`   Email: ${ADMIN_EMAIL}`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`   Password: ${NEW_PASSWORD}`);
        }
        console.log(`\n⚠️  Remember to change this password after testing!`);
        
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error resetting password:', error.message);
        console.error(error);
        process.exit(1);
    }
}

resetAdminPassword();

