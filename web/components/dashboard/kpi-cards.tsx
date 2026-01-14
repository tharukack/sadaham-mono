import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type MealTotals = {
  chicken: number;
  fish: number;
  veg: number;
  egg: number;
  other: number;
};

type SmsTotals = {
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
};

type KpiCardsProps = {
  totalOrders: number;
  totalCustomers: number;
  mealTotals: MealTotals;
  sms: SmsTotals;
  campaignState?: string;
};

export function KpiCards({
  totalOrders,
  totalCustomers,
  mealTotals,
  sms,
  campaignState,
}: KpiCardsProps) {
  const totalMeals =
    mealTotals.chicken + mealTotals.fish + mealTotals.veg + mealTotals.egg + mealTotals.other;

  const items = [
    { label: 'Total Orders', value: totalOrders, note: 'In selected campaign' },
    { label: 'Total Customers', value: totalCustomers, note: 'One order per customer' },
    { label: 'Total Meals', value: totalMeals, note: 'Sum of all meals' },
    { label: 'SMS Delivered', value: sms.delivered, note: 'Campaign messages' },
    { label: 'SMS Failed', value: sms.failed, note: 'Needs attention' },
  ];

  if (campaignState) {
    items.push({ label: 'Campaign State', value: campaignState, note: 'Current status' });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{item.value}</div>
            <p className="text-xs text-muted-foreground">{item.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
