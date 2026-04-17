const normalizeStatusToken = (status: string): string =>
  status.replace(/[^a-z0-9]/gi, '').toLowerCase();

const PENDING_APPROVAL_STATUS_TOKENS = new Set(['pendingapproval']);
const AWAIT_PAYMENT_STATUS_TOKENS = new Set(['awaitpayment', 'awaitingpayment']);

export const isServiceRegistrationPendingApprovalStatus = (status: string): boolean => {
  const token = normalizeStatusToken(status);
  return PENDING_APPROVAL_STATUS_TOKENS.has(token);
};

export const isServiceRegistrationAwaitPaymentStatus = (status: string): boolean => {
  const token = normalizeStatusToken(status);
  return AWAIT_PAYMENT_STATUS_TOKENS.has(token);
};

export const isServiceRegistrationCancellableStatus = (status: string): boolean => {
  return (
    isServiceRegistrationPendingApprovalStatus(status) ||
    isServiceRegistrationAwaitPaymentStatus(status)
  );
};
