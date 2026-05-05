export const DESIGN_ROOM_TYPE_LABELS: Record<number, string> = {
  1: 'Living Room',
  2: 'Bedroom',
  3: 'Kitchen',
  4: 'Bathroom',
  5: 'Home Office',
  6: 'Balcony',
  7: 'Corridor',
  8: 'Dining Room',
};

export const DESIGN_STYLE_LABELS: Record<number, string> = {
  1: 'Minimalist',
  2: 'Scandinavian',
  3: 'Tropical',
  4: 'Industrial',
  5: 'Bohemian',
  6: 'Modern',
  7: 'Japanese',
  8: 'Mediterranean',
  9: 'Rustic',
};

export const getDesignRoomTypeLabel = (value: number): string =>
  DESIGN_ROOM_TYPE_LABELS[value] ?? `Room type #${value}`;

export const getDesignStyleLabel = (value: number): string =>
  DESIGN_STYLE_LABELS[value] ?? `Style #${value}`;

export const getDesignRegistrationStatusPalette = (statusName: string) => {
  const normalized = statusName.trim().toLowerCase();

  if (normalized.includes('pending') || normalized.includes('await')) {
    return {
      backgroundColor: '#FFF3BF',
      textColor: '#A66700',
    };
  }

  if (normalized.includes('progress') || normalized.includes('depositpaid')) {
    return {
      backgroundColor: '#E7F5FF',
      textColor: '#1864AB',
    };
  }

  if (normalized.includes('completed')) {
    return {
      backgroundColor: '#D3F9D8',
      textColor: '#2B8A3E',
    };
  }

  if (normalized.includes('cancel') || normalized.includes('reject')) {
    return {
      backgroundColor: '#FFE3E3',
      textColor: '#C92A2A',
    };
  }

  return {
    backgroundColor: '#F1F3F5',
    textColor: '#495057',
  };
};

export const getDesignTaskStatusPalette = (statusName: string) => {
  const normalized = statusName.trim().toLowerCase();

  if (normalized.includes('assigned') || normalized.includes('pending')) {
    return {
      backgroundColor: '#FFF3BF',
      borderColor: '#FFE066',
      textColor: '#A66700',
    };
  }

  if (normalized.includes('completed')) {
    return {
      backgroundColor: '#D3F9D8',
      borderColor: '#69DB7C',
      textColor: '#2B8A3E',
    };
  }

  if (normalized.includes('cancel')) {
    return {
      backgroundColor: '#FFE3E3',
      borderColor: '#FF8787',
      textColor: '#C92A2A',
    };
  }

  return {
    backgroundColor: '#F1F3F5',
    borderColor: '#DEE2E6',
    textColor: '#495057',
  };
};

export const isDesignRegistrationAwaitPaymentStatus = (statusName: string): boolean => {
  const normalized = statusName.trim().toLowerCase();
  return normalized === 'awaitdeposit' || normalized === 'awaitfinalpayment';
};

export const isDesignRegistrationCancellableStatus = (statusName: string): boolean => {
  const normalized = statusName.trim().toLowerCase();
  return !['completed', 'cancelled', 'rejected'].includes(normalized);
};

export const sortDesignTasks = <T extends { id: number; taskType?: number; createdAt?: string }>(
  tasks: T[]
): T[] =>
  [...tasks].sort((left, right) => {
    const leftType = typeof left.taskType === 'number' ? left.taskType : Number.MAX_SAFE_INTEGER;
    const rightType =
      typeof right.taskType === 'number' ? right.taskType : Number.MAX_SAFE_INTEGER;

    if (leftType !== rightType) {
      return leftType - rightType;
    }

    const leftDate = typeof left.createdAt === 'string' ? Date.parse(left.createdAt) : 0;
    const rightDate = typeof right.createdAt === 'string' ? Date.parse(right.createdAt) : 0;

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return left.id - right.id;
  });
