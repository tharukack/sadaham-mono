import Link from 'next/link';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

type SmsSummaryProps = {
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  isAdmin: boolean;
};

export function SmsSummary({ queued, sent, delivered, failed, isAdmin }: SmsSummaryProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>SMS Delivery</CardTitle>
        {isAdmin && (
          <Button variant="link" asChild>
            <Link href="/admin/sms">Open SMS Status</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Queued: {queued}</Badge>
          <Badge variant="secondary">Sent: {sent}</Badge>
          <Badge variant="secondary">Delivered: {delivered}</Badge>
          <Badge variant="secondary">Failed: {failed}</Badge>
        </div>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Failed messages can be retried from SMS page.
        </p>
      </CardContent>
    </Card>
  );
}
