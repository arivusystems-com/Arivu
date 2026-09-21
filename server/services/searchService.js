/**
 * ============================================================================
 * PLATFORM CORE: Global Search Service
 * ============================================================================
 * 
 * Fast, reliable search across all enabled modules for a tenant.
 * Searches: People, Organizations, Deals, Tasks, Events, Forms, Items
 * 
 * Rules:
 * - Only search enabled modules
 * - Respect organization isolation
 * - Return limited results per module (5-10)
 * - Fast response time (<200ms target)
 * - Case-insensitive search
 * - Prefix matches rank above substring matches
 * 
 * ============================================================================
 */

// Lazy load models to avoid startup errors
let People, Organization, Deal, Task, Event, Form, Item;

try {
  People = require('../models/People');
  Organization = require('../models/Organization');
  Deal = require('../models/Deal');
  Task = require('../models/Task');
  Event = require('../models/Event');
} catch (error) {
  console.error('[SearchService] Error loading core models:', error);
}

let Quote;
try {
  Quote = require('../models/Quote');
} catch (error) {
  console.warn('[SearchService] Quote model not available:', error.message);
}

try {
  Form = require('../models/Form');
} catch (error) {
  console.warn('[SearchService] Form model not available:', error.message);
}

try {
  Item = require('../models/Item');
} catch (error) {
  console.warn('[SearchService] Item model not available:', error.message);
}

const {
  buildContainsRegex,
  buildSearchOrConditions,
  buildPeopleNameOrConditions,
  rankAndLimit
} = require('../utils/searchRelevance');

const OVER_FETCH_MULTIPLIER = 5;
const MIN_OVER_FETCH = 25;

class SearchService {
  /**
   * Search across all enabled modules
   * @param {String} organizationId - Organization ID
   * @param {String} query - Search query
   * @param {Object} options - Search options (limit per module, etc.)
   * @returns {Promise<Object>} Search results grouped by module type
   */
  async searchAll(organizationId, query, options = {}) {
    const limit = options.limitPerModule || 5;
    const searchRegex = buildContainsRegex(query);
    const fetchLimit = Math.max(limit * OVER_FETCH_MULTIPLIER, MIN_OVER_FETCH);
    
    // Build search promises array (only include available models)
    const searchPromises = [
      this.searchPeople(organizationId, query, searchRegex, limit, fetchLimit),
      this.searchOrganizations(organizationId, query, searchRegex, limit, fetchLimit),
      this.searchDeals(organizationId, query, searchRegex, limit, fetchLimit),
      this.searchTasks(organizationId, query, searchRegex, limit, fetchLimit),
      this.searchEvents(organizationId, query, searchRegex, limit, fetchLimit)
    ];
    
    // Add optional models if available
    if (Form) {
      searchPromises.push(this.searchForms(organizationId, query, searchRegex, limit, fetchLimit));
    } else {
      searchPromises.push(Promise.resolve([]));
    }
    
    if (Item) {
      searchPromises.push(this.searchItems(organizationId, query, searchRegex, limit, fetchLimit));
    } else {
      searchPromises.push(Promise.resolve([]));
    }

    if (Quote) {
      searchPromises.push(this.searchQuotes(organizationId, query, searchRegex, limit, fetchLimit));
    } else {
      searchPromises.push(Promise.resolve([]));
    }

    searchPromises.push(this.searchLearningCourses(organizationId, query, searchRegex, limit, fetchLimit));
    
    // Run all searches in parallel for speed
    const [
      people,
      organizations,
      deals,
      tasks,
      events,
      forms,
      items,
      quotes,
      learningCourses,
    ] = await Promise.all(searchPromises);

    return {
      query,
      results: {
        people,
        organizations,
        deals,
        tasks,
        events,
        forms,
        items,
        quotes,
        learningCourses,
      },
      total: people.length + organizations.length + deals.length
             + tasks.length + events.length + forms.length + items.length + quotes.length
             + learningCourses.length
    };
  }

  /**
   * Search People/Contacts
   */
  async searchPeople(organizationId, query, searchRegex, limit, fetchLimit) {
    try {
      const results = await People.find({
        organizationId,
        deletedAt: null,
        $or: buildPeopleNameOrConditions(query),
      })
        .select('first_name last_name email phone mobile avatar organization')
        .populate('organization', 'name')
        .limit(fetchLimit)
        .lean();

      const ranked = rankAndLimit(results, query, [
        { getValue: (person) => person.first_name, primary: true },
        { getValue: (person) => person.last_name, primary: true },
        {
          getValue: (person) => `${person.first_name || ''} ${person.last_name || ''}`.trim(),
          primary: true,
        },
        { getValue: (person) => person.email, primary: false },
        { getValue: (person) => person.phone, primary: false },
      ], limit);

      return ranked.map((person) => ({
        id: person._id,
        type: 'people',
        title: `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email,
        subtitle: (person.organization && person.organization.name) || person.email,
        first_name: person.first_name,
        last_name: person.last_name,
        organizationId: person.organization?._id || person.organization || null,
        organizationName: person.organization?.name || '',
        avatar: person.avatar || null,
        route: `/people/${person._id}`,
      }));
    } catch (error) {
      console.error('[SearchService] Error searching people:', error);
      return [];
    }
  }

  /**
   * Search Organizations (CRM entities only, not tenant organizations)
   * Note: CRM organizations are filtered by createdBy (users from tenant), not organizationId
   * This matches the pattern used in organizationV2Controller.list()
   */
  async searchOrganizations(organizationId, query, searchRegex, limit, fetchLimit) {
    try {
      const User = require('../models/User');
      
      // Get all users from this tenant organization
      const tenantUserIds = await User.find({ organizationId })
        .select('_id')
        .lean();
      const userIds = tenantUserIds.map(u => u._id);
      
      if (userIds.length === 0) {
        console.log(`[SearchService] No users found for tenant organization ${organizationId}, skipping organization search`);
        return [];
      }

      // Build query matching organizationV2Controller.list() pattern
      // CRM organizations created by users from this tenant organization
      const mongoQuery = {
        isTenant: false, // Only CRM organizations
        createdBy: { $in: userIds }, // Only orgs created by users from this tenant
        $or: buildSearchOrConditions(query, ['name', 'email', 'website', 'industry'])
      };

      const results = await Organization.find(mongoQuery)
        .select('name email website industry avatar logo image')
        .limit(fetchLimit)
        .lean();

      console.log(`[SearchService] Found ${results.length} organizations matching "${query}" for tenant ${organizationId}`);

      const ranked = rankAndLimit(results, query, [
        { getValue: (org) => org.name, primary: true },
        { getValue: (org) => org.email, primary: false },
        { getValue: (org) => org.website, primary: false },
        { getValue: (org) => org.industry, primary: false }
      ], limit);

      return ranked.map(org => ({
        id: org._id,
        type: 'organizations',
        title: org.name,
        subtitle: org.industry || org.email,
        avatar: org.avatar || org.logo || org.image || null,
        route: `/organizations/${org._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching organizations:', error);
      return [];
    }
  }

  /**
   * Search Deals
   */
  async searchDeals(organizationId, query, searchRegex, limit, fetchLimit) {
    try {
      const results = await Deal.find({
        organizationId,
        $or: buildSearchOrConditions(query, ['name', 'description', 'stage'])
      })
      .select('name description stage value currency')
      .limit(fetchLimit)
      .lean();

      const ranked = rankAndLimit(results, query, [
        { getValue: (deal) => deal.name, primary: true },
        { getValue: (deal) => deal.description, primary: false },
        { getValue: (deal) => deal.stage, primary: false }
      ], limit);

      return ranked.map(deal => ({
        id: deal._id,
        type: 'deals',
        title: deal.name,
        subtitle: `${deal.stage} • ${deal.currency || '$'}${deal.value || 0}`,
        route: `/deals/${deal._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching deals:', error);
      return [];
    }
  }

  /**
   * Search Quotes
   */
  async searchQuotes(organizationId, query, searchRegex, limit, fetchLimit) {
    try {
      if (!Quote) return [];
      const results = await Quote.find({
        organizationId,
        deletedAt: null,
        $or: buildSearchOrConditions(query, ['quoteTitle', 'quoteNumber', 'status']),
      })
        .select('quoteTitle quoteNumber status validUntil currency')
        .limit(fetchLimit)
        .lean();

      const ranked = rankAndLimit(results, query, [
        { getValue: (q) => q.quoteTitle, primary: true },
        { getValue: (q) => q.quoteNumber, primary: true },
        { getValue: (q) => q.status, primary: false },
      ], limit);

      return ranked.map((q) => ({
        id: q._id,
        type: 'quotes',
        title: q.quoteTitle || q.quoteNumber || 'Quote',
        subtitle: [q.status, q.quoteNumber].filter(Boolean).join(' • '),
        route: `/quotes/${q._id}`,
      }));
    } catch (error) {
      console.error('[SearchService] Error searching quotes:', error);
      return [];
    }
  }

  /**
   * Search Tasks
   */
  async searchTasks(organizationId, query, searchRegex, limit, fetchLimit) {
    try {
      const results = await Task.find({
        organizationId,
        $or: buildSearchOrConditions(query, ['title', 'description'])
      })
      .select('title description status priority')
      .limit(fetchLimit)
      .lean();

      const ranked = rankAndLimit(results, query, [
        { getValue: (task) => task.title, primary: true },
        { getValue: (task) => task.description, primary: false }
      ], limit);

      return ranked.map(task => ({
        id: task._id,
        type: 'tasks',
        title: task.title,
        subtitle: `${task.status} • ${task.priority || 'medium'}`,
        route: `/tasks/${task._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching tasks:', error);
      return [];
    }
  }

  /**
   * Search Events
   */
  async searchEvents(organizationId, query, searchRegex, limit, fetchLimit) {
    try {
      const results = await Event.find({
        organizationId,
        $or: buildSearchOrConditions(query, ['eventName', 'notes', 'location', 'eventType'])
      })
      .select('eventName eventType notes location startDateTime endDateTime')
      .limit(fetchLimit)
      .lean();

      const ranked = rankAndLimit(results, query, [
        { getValue: (event) => event.eventName, primary: true },
        { getValue: (event) => event.location, primary: false },
        { getValue: (event) => event.eventType, primary: false }
      ], limit);

      console.log(`[SearchService] Found ${results.length} events matching "${query}" for tenant ${organizationId}`);

      return ranked.map(event => ({
        id: event._id,
        type: 'events',
        title: event.eventName, // Map eventName to title for display
        subtitle: event.eventType || 'Event',
        route: `/events/${event._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching events:', error);
      return [];
    }
  }

  /**
   * Search Forms
   */
  async searchForms(organizationId, query, searchRegex, limit, fetchLimit) {
    if (!Form) {
      return [];
    }
    try {
      const results = await Form.find({
        organizationId,
        $or: buildSearchOrConditions(query, ['name', 'description'])
      })
      .select('name description')
      .limit(fetchLimit)
      .lean();

      const ranked = rankAndLimit(results, query, [
        { getValue: (form) => form.name, primary: true },
        { getValue: (form) => form.description, primary: false }
      ], limit);

      return ranked.map(form => ({
        id: form._id,
        type: 'forms',
        title: form.name || 'Form',
        subtitle: form.description || 'Form',
        route: `/forms/${form._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching forms:', error);
      return [];
    }
  }

  /**
   * Search Items
   */
  async searchItems(organizationId, query, searchRegex, limit, fetchLimit) {
    if (!Item) {
      return [];
    }
    try {
      const results = await Item.find({
        organizationId,
        $or: buildSearchOrConditions(query, ['item_name', 'description', 'item_code'])
      })
      .select('item_name description item_code')
      .limit(fetchLimit)
      .lean();

      const ranked = rankAndLimit(results, query, [
        { getValue: (item) => item.item_name, primary: true },
        { getValue: (item) => item.item_code, primary: false },
        { getValue: (item) => item.description, primary: false }
      ], limit);

      return ranked.map(item => ({
        id: item._id,
        type: 'items',
        title: item.item_name || 'Item',
        subtitle: item.description || item.item_code || 'Item',
        route: `/items/${item._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching items:', error);
      return [];
    }
  }

  /**
   * Search Learning courses (when LMS is enabled for the org)
   */
  async searchLearningCourses(organizationId, query, searchRegex, limit, fetchLimit) {
    try {
      let LearningCourse;
      try {
        LearningCourse = require('../models/learning/LearningCourse');
      } catch {
        return [];
      }

      const Organization = require('../models/Organization');
      const org = await Organization.findById(organizationId).select('enabledApps').lean();
      const enabled = Array.isArray(org?.enabledApps) ? org.enabledApps : [];
      const lmsOn = enabled.some((e) => {
        const key = typeof e === 'object' && e !== null ? e.appKey : e;
        const status = typeof e === 'object' && e !== null ? e.status : 'ACTIVE';
        return String(key || '').toUpperCase() === 'LMS'
          && String(status || 'ACTIVE').toUpperCase() === 'ACTIVE';
      });
      if (!lmsOn) return [];

      const results = await LearningCourse.find({
        organizationId,
        status: 'published',
        $or: buildSearchOrConditions(query, ['title', 'description']),
      })
        .select('title description status')
        .limit(fetchLimit)
        .lean();

      const ranked = rankAndLimit(results, query, [
        { getValue: (c) => c.title, primary: true },
        { getValue: (c) => c.description, primary: false },
      ], limit);

      return ranked.map((course) => ({
        id: course._id,
        type: 'learningCourses',
        title: course.title || 'Course',
        subtitle: course.description || 'Learning course',
        route: `/learning/courses/${course._id}`,
      }));
    } catch (error) {
      console.error('[SearchService] Error searching learning courses:', error);
      return [];
    }
  }
}

module.exports = new SearchService();
