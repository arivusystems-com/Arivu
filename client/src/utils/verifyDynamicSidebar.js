/**
 * Dynamic Sidebar Verification Utility
 * 
 * Run this in browser console to verify dynamic sidebar is working:
 * 
 * import('/src/utils/verifyDynamicSidebar.js').then(m => m.verifyDynamicSidebar())
 * 
 * Or copy-paste the function into console
 */

import { useAppShellStore } from '@/stores/appShell';
import { useAuthStore } from '@/stores/authRegistry';

export async function verifyDynamicSidebar() {
  console.log('🔍 Verifying Dynamic Sidebar (Phase 0D)...\n');
  
  try {
    const appShellStore = useAppShellStore();
    const authStore = useAuthStore();
    
    console.log('📊 Authentication Status:');
    console.log('  - Authenticated:', authStore.isAuthenticated);
    console.log('  - User:', authStore.user?.email || 'Not logged in');
    console.log('  - Organization ID:', authStore.user?.organizationId || 'N/A');
    console.log('');
    
    console.log('📦 App Shell Store Status:');
    console.log('  - Is Loaded:', appShellStore.isLoaded);
    console.log('  - Loading:', appShellStore.loading);
    console.log('  - Error:', appShellStore.error || 'None');
    console.log('  - Last Loaded:', appShellStore.lastLoaded || 'Never');
    console.log('');
    
    console.log('📱 Available Apps:');
    if (appShellStore.availableApps.length > 0) {
      appShellStore.availableApps.forEach(app => {
        console.log(`  ✅ ${app.appKey}: ${app.name}`);
        console.log(`     Icon: ${app.icon}, Route: ${app.defaultRoute}`);
      });
    } else {
      console.log('  ❌ No apps found');
    }
    console.log('');
    
    console.log('📋 Sidebar Modules:');
    if (appShellStore.sidebarModules.length > 0) {
      appShellStore.sidebarModules.forEach((module, index) => {
        console.log(`  ${index + 1}. ${module.label} (${module.moduleKey})`);
        console.log(`     Route: ${module.routeBase}, Order: ${module.sidebarOrder}`);
      });
    } else {
      console.log('  ❌ No modules found');
    }
    console.log('');
    
    console.log('🔄 Active App:');
    console.log('  - App Key:', appShellStore.activeApp || 'None');
    if (appShellStore.activeApp) {
      const activeAppModules = appShellStore.activeAppModules;
      console.log(`  - Modules: ${activeAppModules.length}`);
    }
    console.log('');
    
    // Check Network Request
    console.log('🌐 Network Check:');
    const networkEntries = performance.getEntriesByType('resource');
    const sidebarRequest = networkEntries.find(entry => 
      entry.name.includes('/api/ui/sidebar')
    );
    
    if (sidebarRequest) {
      console.log('  ✅ Sidebar API request found');
      console.log(`     URL: ${sidebarRequest.name}`);
      console.log(`     Status: ${sidebarRequest.responseStatus || 'Unknown'}`);
      console.log(`     Duration: ${Math.round(sidebarRequest.duration)}ms`);
    } else {
      console.log('  ⚠️  No sidebar API request found in performance entries');
      console.log('     (This might be normal if request was made before page load)');
    }
    console.log('');
    
    // Final Verdict
    console.log('═'.repeat(50));
    if (appShellStore.isLoaded && appShellStore.availableApps.length > 0) {
      console.log('✅ DYNAMIC SIDEBAR IS WORKING!');
      console.log('');
      console.log('Evidence:');
      console.log('  ✅ UI metadata loaded (isLoaded: true)');
      console.log(`  ✅ ${appShellStore.availableApps.length} app(s) available`);
      console.log(`  ✅ ${appShellStore.sidebarModules.length} module(s) in sidebar`);
      console.log('');
      console.log('The sidebar is rendering from API data, not hardcoded navigation.');
    } else {
      console.log('❌ DYNAMIC SIDEBAR NOT WORKING - Using Fallback');
      console.log('');
      console.log('Issues:');
      if (!appShellStore.isLoaded) {
        console.log('  ❌ UI metadata not loaded (isLoaded: false)');
      }
      if (appShellStore.availableApps.length === 0) {
        console.log('  ❌ No apps available');
      }
      if (appShellStore.error) {
        console.log(`  ❌ Error: ${appShellStore.error}`);
      }
      console.log('');
      console.log('The sidebar is using hardcoded navigation as fallback.');
      console.log('');
      console.log('💡 Try:');
      console.log('  1. Check if user is authenticated');
      console.log('  2. Manually load: await appShellStore.loadUIMetadata()');
      console.log('  3. Check browser console for errors');
      console.log('  4. Verify API endpoint: GET /api/ui/sidebar');
    }
    console.log('═'.repeat(50));
    
    return {
      isWorking: appShellStore.isLoaded && appShellStore.availableApps.length > 0,
      isLoaded: appShellStore.isLoaded,
      appsCount: appShellStore.availableApps.length,
      modulesCount: appShellStore.sidebarModules.length,
      error: appShellStore.error
    };
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
    return { isWorking: false, error: error.message };
  }
}

// Also export a simpler check function
export function quickCheck() {
  const store = useAppShellStore();
  
  const isWorking = store.isLoaded && store.availableApps.length > 0;
  
  console.log(isWorking ? '✅ Dynamic sidebar working' : '❌ Dynamic sidebar not working');
  console.log('Apps:', store.availableApps.length, 'Modules:', store.sidebarModules.length);
  
  return isWorking;
}

