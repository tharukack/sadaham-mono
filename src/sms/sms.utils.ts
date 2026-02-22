export const interpolateOrderTemplate = (body: string, order: any) => {
  const mealCounts = {
    chicken: Number(order.chickenQty || 0),
    fish: Number(order.fishQty || 0),
    veg: Number(order.vegQty || 0),
    egg: Number(order.eggQty || 0),
    other: Number(order.otherQty || 0),
  };
  const mealCosts = {
    chicken: Number(order.campaign?.chickenCost || 0),
    fish: Number(order.campaign?.fishCost || 0),
    veg: Number(order.campaign?.vegCost || 0),
    egg: Number(order.campaign?.eggCost || 0),
    other: Number(order.campaign?.otherCost || 0),
  };
  const totalOrders =
    mealCounts.chicken + mealCounts.fish + mealCounts.veg + mealCounts.egg + mealCounts.other;
  const pickupByName = order.pickupByCustomer
    ? `${order.pickupByCustomer.firstName || ''} ${order.pickupByCustomer.lastName || ''}`.trim()
    : '';
  const customerName = order.customer
    ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim()
    : '';
  const createdByName = order.createdBy
    ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim()
    : '';
  const createdByMobile = order.createdBy?.mobile || '';
  const mainCollectorName = order.createdBy?.mainCollector
    ? `${order.createdBy.mainCollector.firstName || ''} ${order.createdBy.mainCollector.lastName || ''}`.trim()
    : '';
  const mainCollectorLabel = mainCollectorName || createdByName;
  const mainCollectorMobile = order.createdBy?.mainCollector?.mobile || order.createdBy?.mobile || '';
  const pickupBySameAsCustomer =
    (order.pickupByCustomer?.id && order.customer?.id
      ? order.pickupByCustomer.id === order.customer.id
      : false) || (pickupByName && customerName && pickupByName === customerName);
  const notes = (order.note || '').toString().trim();
  const eventDate = order.campaign?.eventDate ? new Date(order.campaign.eventDate) : null;
  const eventDateLabel = eventDate ? eventDate.toISOString().slice(0, 10) : '';
  const lastDateForChanges = eventDate
    ? new Date(eventDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : '';
  const totalCost =
    mealCounts.chicken * mealCosts.chicken +
    mealCounts.fish * mealCosts.fish +
    mealCounts.veg * mealCosts.veg +
    mealCounts.egg * mealCosts.egg +
    mealCounts.other * mealCosts.other;
  const replacements: Record<string, string> = {
    '{{firstName}}': order.customer?.firstName || '',
    '{{lastName}}': order.customer?.lastName || '',
    '{{pickupLocation}}': order.pickupLocation?.name || '',
    '{{pickupAddress}}': order.pickupLocation?.address || '',
    '{{distributorName}}': order.pickupLocation?.distributorName || '',
    '{{distributorMobile}}': order.pickupLocation?.distributorMobile || '',
    '{{distributorAddress}}': order.pickupLocation?.address || '',
    '{{enteredByName}}': createdByName,
    '{{enteredByMobile}}': createdByMobile,
    '{{mainCollectorName}}': mainCollectorLabel || '',
    '{{mainCollectorMobile}}': mainCollectorMobile,
    '{{eventDate}}': eventDateLabel,
    '{{lastDateForChanges}}': lastDateForChanges,
    '{{totalCost}}': totalCost.toFixed(2),
    '{{campaignName}}': order.campaign?.name || '',
    '{{totalOrders}}': String(totalOrders),
    '{{chickenQty}}': String(mealCounts.chicken),
    '{{fishQty}}': String(mealCounts.fish),
    '{{vegQty}}': String(mealCounts.veg),
    '{{eggQty}}': String(mealCounts.egg),
    '{{otherQty}}': String(mealCounts.other),
    '{{chickenCost}}': String(mealCosts.chicken),
    '{{fishCost}}': String(mealCosts.fish),
    '{{vegCost}}': String(mealCosts.veg),
    '{{eggCost}}': String(mealCosts.egg),
    '{{otherCost}}': String(mealCosts.other),
    '{{notes}}': notes,
    '{{pickupBy}}': pickupByName,
    // Legacy placeholders (keep for backward compatibility)
    '{{nooforders}}': String(totalOrders),
    '{{numberofchicken}}': String(mealCounts.chicken),
    '{{numberoffish}}': String(mealCounts.fish),
    '{{numberofveg}}': String(mealCounts.veg),
    '{{numberofegg}}': String(mealCounts.egg),
    '{{numberofothers}}': String(mealCounts.other),
  };
  const optionalLineTokens: Array<{ tokens: string[]; omit: boolean }> = [
    { tokens: ['{{totalOrders}}', '{{nooforders}}'], omit: totalOrders === 0 },
    { tokens: ['{{chickenQty}}', '{{numberofchicken}}'], omit: mealCounts.chicken === 0 },
    { tokens: ['{{fishQty}}', '{{numberoffish}}'], omit: mealCounts.fish === 0 },
    { tokens: ['{{vegQty}}', '{{numberofveg}}'], omit: mealCounts.veg === 0 },
    { tokens: ['{{eggQty}}', '{{numberofegg}}'], omit: mealCounts.egg === 0 },
    { tokens: ['{{otherQty}}', '{{numberofothers}}'], omit: mealCounts.other === 0 },
    { tokens: ['{{notes}}'], omit: notes.length === 0 },
    { tokens: ['{{lastDateForChanges}}'], omit: !lastDateForChanges },
    { tokens: ['{{pickupBy}}'], omit: pickupBySameAsCustomer },
  ];
  const lines = body.split(/\r?\n/);
  const filtered: string[] = [];
  lines.forEach((line) => {
    const tokenRule = optionalLineTokens.find((rule) =>
      rule.tokens.some((token) => line.includes(token))
    );
    if (!tokenRule) {
      filtered.push(line);
      return;
    }
    if (!tokenRule.omit) {
      filtered.push(line);
      return;
    }
    if (tokenRule.tokens.includes('{{notes}}') || tokenRule.tokens.includes('{{pickupBy}}')) {
      const prev = filtered[filtered.length - 1];
      if (prev !== undefined && prev.trim().length === 0) {
        filtered.pop();
      }
    }
  });
  let result = filtered.join('\n');
  Object.entries(replacements).forEach(([token, value]) => {
    result = result.split(token).join(value);
  });
  return result;
};
