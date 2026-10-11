# Internal Tabs - Quick Reference Guide

## 🚀 Quick Start

### Opening Tabs from Components

#### Method 1: Simple Utility Function (Recommended)
```javascript
import { openRecordInTab } from '@/utils/tabNavigation';

// Open any record
openRecordInTab('/contacts/123', {
  title: 'John Doe',
  icon: '👤'
});
```

#### Method 2: In Click Handlers
```vue
<template>
  <button @click="viewContact(contact)">View</button>
</template>

<script setup>
import { openRecordInTab } from '@/utils/tabNavigation';

const viewContact = (contact) => {
  openRecordInTab(`/contacts/${contact._id}`, {
    title: contact.name,
    icon: '👤',
    params: { name: contact.name }
  });
};
</script>
```

#### Method 3: In DataTable Row Click
```vue
<script setup>
import { openRecordInTab } from '@/utils/tabNavigation';

const handleRowClick = (row) => {
  openRecordInTab(`/contacts/${row._id}`, {
    title: row.name || 'Contact Detail',
    icon: '👤'
  });
};
</script>

<template>
  <DataTable 
    :data="contacts"
    @row-click="handleRowClick"
  />
</template>
```

#### Method 4: Direct Link with Prevent
```vue
<template>
  <a 
    :href="`/contacts/${contact._id}`"
    @click.prevent="openContactTab(contact)"
    class="text-blue-600 hover:underline cursor-pointer"
  >
    {{ contact.name }}
  </a>
</template>

<script setup>
import { openRecordInTab } from '@/utils/tabNavigation';

const openContactTab = (contact) => {
  openRecordInTab(`/contacts/${contact._id}`, {
    title: contact.name,
    icon: '👤'
  });
};
</script>
```

## 📋 Common Patterns

### Opening Different Modules

```javascript
// Contacts
openRecordInTab(`/contacts/${id}`, { title: 'John Doe', icon: '👤' });

// Organizations
openRecordInTab(`/organizations/${id}`, { title: 'Acme Corp', icon: '🏢' });

// Deals
openRecordInTab(`/deals/${id}`, { title: 'Enterprise Deal', icon: '💼' });

// Tasks
openRecordInTab(`/tasks/${id}`, { title: 'Follow Up', icon: '✅' });

// Calendar Events
openRecordInTab(`/calendar/${id}`, { title: 'Meeting', icon: '📅' });

// Projects
openRecordInTab(`/items/${id}`, { title: 'Project Alpha', icon: '📁' });
```

### Updating Tab Title After Data Change

```javascript
import { useTabs } from '@/composables/useTabs';

const { updateTabTitle, findTabByPath } = useTabs();

const updateContactName = async (contactId, newName) => {
  // Update the contact
  await api.updateContact(contactId, { name: newName });
  
  // Update tab title if tab is open
  const tab = findTabByPath(`/contacts/${contactId}`);
  if (tab) {
    updateTabTitle(tab.id, newName);
  }
};
```

### Closing Tabs Programmatically

```javascript
import { useTabs } from '@/composables/useTabs';

const { closeTab, findTabByPath } = useTabs();

// Close a specific tab
const closeContactTab = (contactId) => {
  const tab = findTabByPath(`/contacts/${contactId}`);
  if (tab) {
    closeTab(tab.id);
  }
};
```

## 🎨 Default Icons Reference

| Module | Icon | Path |
|--------|------|------|
| Dashboard | 🏠 | `/dashboard` |
| Contacts | 👥 | `/contacts` |
| Organizations | 🏢 | `/organizations` |
| Deals | 💼 | `/deals` |
| Tasks | ✅ | `/tasks` |
| Calendar | 📅 | `/calendar` |
| Imports | ⬇️ | `/imports` |
| Projects | 📁 | `/items` |
| Demo Requests | 📚 | `/demo-requests` |
| Instances | 🖥️ | `/instances` |
| Default | 📄 | any other path |

## 🔧 Advanced Usage

### Using the Composable Directly

```javascript
import { useTabs } from '@/composables/useTabs';

const { 
  tabs,              // Array of all tabs
  activeTabId,       // Current active tab ID
  activeTab,         // Current active tab object
  openTab,           // Open or focus a tab
  closeTab,          // Close a tab
  switchToTab,       // Switch to a tab
  updateTabTitle,    // Update tab title
  reorderTabs,       // Reorder tabs
  findTabByPath,     // Find tab by path
  findTabById,       // Find tab by ID
  closeOtherTabs,    // Close all except one
  closeAllTabs       // Close all closable tabs
} = useTabs();

// Example: Check if a tab is already open
const isTabOpen = (path) => {
  return !!findTabByPath(path);
};

// Example: Get count of open tabs
const openTabCount = computed(() => tabs.value.length);
```

### Custom Tab Properties

```javascript
openRecordInTab('/custom-page', {
  title: 'Custom Page',
  icon: '🎯',
  closable: false,  // Make it non-closable like dashboard
  params: {
    // Store any custom data
    customData: 'value',
    timestamp: Date.now()
  }
});
```

## ⚠️ Important Notes

### DO ✅
- Always provide a meaningful title
- Use appropriate icons for better UX
- Handle edge cases (missing data, null values)
- Update tab titles when data changes
- Use `.prevent` on click handlers to prevent default navigation

### DON'T ❌
- Don't use `router.push()` directly for in-app navigation
- Don't use `router-link` without preventing default behavior
- Don't forget to provide titles (defaults may not be user-friendly)
- Don't create too many tabs without user awareness

## 🐛 Troubleshooting

### Tabs not opening?
```javascript
// Check console for errors
console.log('Opening tab:', path, options);
openRecordInTab(path, options);
```

### Tab opens but shows wrong content?
```javascript
// Ensure path matches your route configuration
// Check router/index.js for correct paths
```

### Tab title not updating?
```javascript
// Make sure you're using the correct tab ID or path
const tab = findTabByPath(path);
console.log('Found tab:', tab);
if (tab) {
  updateTabTitle(tab.id, newTitle);
}
```

## 📖 Full Documentation

For complete documentation, see:
- [/client/src/composables/useTabs.js](../client/src/composables/useTabs.js) - Source code
- [/client/src/utils/tabNavigation.js](../client/src/utils/tabNavigation.js) - Helper utilities

## 🎯 Migration Checklist

When updating existing components:

- [ ] Replace `router-link` with `<a>` + `@click.prevent`
- [ ] Replace `router.push()` with `openRecordInTab()`
- [ ] Add proper titles to all tab opens
- [ ] Test tab creation
- [ ] Test tab persistence after refresh
- [ ] Test tab closing
- [ ] Test drag and drop reordering
- [ ] Update any navigation guards if needed

## 💡 Tips

1. **Consistent Icons**: Use the same icon for the same module throughout the app
2. **Descriptive Titles**: Use actual record names instead of generic "Detail" titles
3. **Performance**: The tab system handles duplicate prevention automatically
4. **Persistence**: Tab state is saved automatically, no manual work needed
5. **Accessibility**: The tab system maintains browser history for back/forward buttons

## Example: Complete Contact Component

```vue
<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Contacts</h1>
    
    <!-- Table with clickable rows -->
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white dark:bg-gray-800 rounded-lg">
        <thead>
          <tr class="bg-gray-100 dark:bg-gray-700">
            <th class="px-4 py-2">Name</th>
            <th class="px-4 py-2">Email</th>
            <th class="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="contact in contacts"
            :key="contact._id"
            @click="viewContact(contact)"
            class="border-b hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          >
            <td class="px-4 py-2">{{ contact.name }}</td>
            <td class="px-4 py-2">{{ contact.email }}</td>
            <td class="px-4 py-2">
              <button
                @click.stop="editContact(contact)"
                class="text-blue-600 hover:text-blue-800 mr-2"
              >
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { openRecordInTab } from '@/utils/tabNavigation';
import apiClient from '@/utils/apiClient';

const contacts = ref([]);

const fetchContacts = async () => {
  const response = await apiClient.get('/api/contacts');
  contacts.value = response.data;
};

const viewContact = (contact) => {
  openRecordInTab(`/contacts/${contact._id}`, {
    title: contact.name,
    icon: '👤',
    params: { name: contact.name }
  });
};

const editContact = (contact) => {
  openRecordInTab(`/contacts/${contact._id}/edit`, {
    title: `Edit: ${contact.name}`,
    icon: '✏️',
    params: { name: contact.name, mode: 'edit' }
  });
};

onMounted(() => {
  fetchContacts();
});
</script>
```

---

**Ready to use!** Start integrating tabs into your components using the patterns above. 🎉

