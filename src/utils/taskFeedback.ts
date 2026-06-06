export function isCompletedTaskStatus(statusName: string): boolean {
  return (statusName ?? '').trim().toLowerCase().includes('completed');
}

export function hasCustomerFeedback(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function canSubmitCustomerTaskFeedback(
  statusName: string,
  customerFeedback: string | null | undefined
): boolean {
  return isCompletedTaskStatus(statusName) && !hasCustomerFeedback(customerFeedback);
}
