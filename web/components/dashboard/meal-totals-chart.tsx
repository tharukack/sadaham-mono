import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type MealTotals = {
  chicken: number;
  fish: number;
  veg: number;
  egg: number;
  other: number;
};

type MealTotalsChartProps = {
  totals: MealTotals;
};

export function MealTotalsChart({ totals }: MealTotalsChartProps) {
  const data = [
    { name: 'Chicken', value: totals.chicken },
    { name: 'Fish', value: totals.fish },
    { name: 'Veg', value: totals.veg },
    { name: 'Egg', value: totals.egg },
    { name: 'Other', value: totals.other },
  ];

  const hasData = data.some((item) => item.value > 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Meal Type Totals</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
