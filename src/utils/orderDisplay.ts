import { InvoiceDetail, OrderPayload } from '../types';

export type OrderDisplayLineItem = {
  id: string;
  itemName: string;
  quantity: number;
  price: number;
  amount: number;
  imageUrl?: string | null;
};

const ORDER_TYPE_FALLBACKS: Record<number, string> = {
  1: 'OtherProduct',
  2: 'PlantInstance',
  3: 'OtherProductBuyNow',
  4: 'Service',
  5: 'Design',
  6: 'TierPackage',
};

const ORDER_TYPE_WITHOUT_ITEM_IMAGES = new Set(['service', 'design', 'tierpackage']);

const splitWords = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

export const normalizeOrderTypeToken = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, '').toLowerCase();

export const humanizeOrderType = (value: string | null | undefined): string => {
  const normalized = value?.trim();
  return normalized ? splitWords(normalized) : 'Order';
};

export const resolveOrderTypeName = (
  order: Pick<OrderPayload, 'orderType' | 'orderTypeName'>,
  enumLabel?: string
): string => enumLabel || order.orderTypeName || ORDER_TYPE_FALLBACKS[order.orderType] || 'Order';

export const shouldDisplayOrderItemImages = (
  order: Pick<OrderPayload, 'orderType' | 'orderTypeName'>,
  enumLabel?: string
): boolean => {
  const orderTypeName = resolveOrderTypeName(order, enumLabel);
  return !ORDER_TYPE_WITHOUT_ITEM_IMAGES.has(normalizeOrderTypeToken(orderTypeName));
};

export const getOrderDisplayLineItems = (order: OrderPayload): OrderDisplayLineItem[] => {
  if (order.items.length > 0) {
    return order.items.map((item) => ({
      id: `item-${item.id}`,
      itemName: item.itemName,
      quantity: item.quantity,
      price: item.price,
      amount: item.price * item.quantity,
      imageUrl:
        item.itemImageUrl ??
        item.itemImage ??
        item.primaryImageUrl ??
        item.imageUrl ??
        null,
    }));
  }

  const invoiceDetails = order.invoices.flatMap((invoice) =>
    invoice.details.map((detail: InvoiceDetail) => ({
      id: `invoice-${invoice.id}-detail-${detail.id}`,
      itemName: detail.itemName,
      quantity: detail.quantity,
      price: detail.unitPrice,
      amount: detail.amount,
      imageUrl: null,
    }))
  );

  if (invoiceDetails.length > 0) {
    return invoiceDetails;
  }

  return [
    {
      id: `order-${order.id}-type-${order.orderType}`,
      itemName: humanizeOrderType(order.orderTypeName || ORDER_TYPE_FALLBACKS[order.orderType]),
      quantity: 1,
      price: order.totalAmount,
      amount: order.totalAmount,
      imageUrl: null,
    },
  ];
};
