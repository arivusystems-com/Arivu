import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import {
  canAdminLearning,
  canAuthorLearning,
  resolveLearningRole,
  type LearningRoleKey,
} from '@/utils/learningRoles';

export function useLearningRole() {
  const authStore = useAuthStore();

  const role = computed<LearningRoleKey | null>(() => resolveLearningRole(authStore.user));

  const canAuthor = computed(() => canAuthorLearning(role.value));
  const canAdmin = computed(() => canAdminLearning(role.value));
  const isLearnerOnly = computed(() => role.value === 'LEARNER');

  return {
    role,
    canAuthor,
    canAdmin,
    isLearnerOnly,
  };
}
