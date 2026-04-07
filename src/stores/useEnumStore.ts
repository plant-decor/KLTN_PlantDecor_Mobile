import { create } from 'zustand';
import { enumService } from '../services/enumService';
import { SystemEnumGroup, SystemEnumValue } from '../types';
import {
  getCanonicalEnumGroupName,
  getFallbackEnumGroupsByResource,
  getFallbackEnumValues,
  normalizeEnumLookupKey,
} from '../utils/enumFallbacks';

interface EnumState {
  groups: Record<string, SystemEnumValue[]>;
  resourceLoaded: Record<string, boolean>;
  resourceLoading: Record<string, boolean>;
  resourceErrors: Record<string, string | null>;
  loadResource: (resourceName: string) => Promise<void>;
  preloadResources: (resourceNames: string[]) => Promise<void>;
  getEnumValues: (groupNames: string[]) => SystemEnumValue[];
}

const cloneValues = (values: SystemEnumValue[]): SystemEnumValue[] =>
  values.map((value) => ({ ...value }));

const toResourceKey = (resourceName: string): string =>
  normalizeEnumLookupKey(resourceName);

const toGroupKey = (groupName: string): string =>
  normalizeEnumLookupKey(getCanonicalEnumGroupName(groupName));

const mergeGroups = (
  currentGroups: Record<string, SystemEnumValue[]>,
  incomingGroups: SystemEnumGroup[]
): Record<string, SystemEnumValue[]> => {
  const nextGroups = { ...currentGroups };

  incomingGroups.forEach((group) => {
    const groupKey = toGroupKey(group.enumName);
    if (group.values.length > 0) {
      nextGroups[groupKey] = cloneValues(group.values);
    }
  });

  return nextGroups;
};

export const useEnumStore = create<EnumState>((set, get) => ({
  groups: {},
  resourceLoaded: {},
  resourceLoading: {},
  resourceErrors: {},

  loadResource: async (resourceName: string) => {
    const resourceKey = toResourceKey(resourceName);
    const state = get();

    if (state.resourceLoaded[resourceKey] || state.resourceLoading[resourceKey]) {
      return;
    }

    set((currentState) => ({
      resourceLoading: {
        ...currentState.resourceLoading,
        [resourceKey]: true,
      },
      resourceErrors: {
        ...currentState.resourceErrors,
        [resourceKey]: null,
      },
    }));

    try {
      const groups = await enumService.getByName(resourceName);
      const groupsToMerge =
        groups.length > 0 ? groups : getFallbackEnumGroupsByResource(resourceName);

      set((currentState) => ({
        groups: mergeGroups(currentState.groups, groupsToMerge),
        resourceLoaded: {
          ...currentState.resourceLoaded,
          [resourceKey]: true,
        },
        resourceLoading: {
          ...currentState.resourceLoading,
          [resourceKey]: false,
        },
        resourceErrors: {
          ...currentState.resourceErrors,
          [resourceKey]: null,
        },
      }));
    } catch (error: any) {
      const fallbackGroups = getFallbackEnumGroupsByResource(resourceName);

      set((currentState) => ({
        groups: mergeGroups(currentState.groups, fallbackGroups),
        resourceLoaded: {
          ...currentState.resourceLoaded,
          [resourceKey]: true,
        },
        resourceLoading: {
          ...currentState.resourceLoading,
          [resourceKey]: false,
        },
        resourceErrors: {
          ...currentState.resourceErrors,
          [resourceKey]:
            error?.response?.data?.message || 'Unable to load enum resource.',
        },
      }));
    }
  },

  preloadResources: async (resourceNames: string[]) => {
    await Promise.all(
      resourceNames.map((resourceName) => get().loadResource(resourceName))
    );
  },

  getEnumValues: (groupNames: string[]) => {
    const { groups } = get();

    for (const groupName of groupNames) {
      const groupKey = toGroupKey(groupName);
      const values = groups[groupKey];
      if (values && values.length > 0) {
        return cloneValues(values);
      }
    }

    for (const groupName of groupNames) {
      const groupKey = normalizeEnumLookupKey(groupName);
      const values = groups[groupKey];
      if (values && values.length > 0) {
        return cloneValues(values);
      }
    }

    return getFallbackEnumValues(groupNames);
  },
}));
