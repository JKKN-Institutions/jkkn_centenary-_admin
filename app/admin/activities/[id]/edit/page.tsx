/**
 * Edit Activity Page
 * Form for editing an existing JKKN Centenary Activity
 */

'use client';

import { useEffect } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useActivity } from '@/hooks/content/use-activities';
import { usePermissions } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { ActivityForm } from '../../_components/activity-form';

export default function EditActivityPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    hasPermission,
    profile,
    loading: permissionsLoading
  } = usePermissions();
  const { activity, loading, error } = useActivity(id);

  // Check if user can edit this specific activity
  // Anyone with activities.update permission can edit ANY activity (Super Admin, Activities Coordinator, etc.)
  const hasUpdatePermission = hasPermission('activities', 'update');
  const canUpdate = hasUpdatePermission;

  useEffect(() => {
    if (!permissionsLoading && !loading && !canUpdate) {
      router.push('/admin/activities');
    }
  }, [canUpdate, permissionsLoading, loading, router]);

  if (loading || permissionsLoading) {
    return (
      <div className='p-2 max-w-9xl mx-auto'>
        <Skeleton className='h-12 w-64 mb-6' />
        <Skeleton className='h-96' />
      </div>
    );
  }

  if (!canUpdate) {
    return null;
  }

  if (error || !activity) {
    return (
      <div className='p-6 max-w-9xl mx-auto'>
        <Card className='p-8 text-center'>
          <p className='text-destructive'>{error || 'Activity not found'}</p>
          <Button
            onClick={() => router.push('/admin/activities')}
            className='mt-4'
          >
            Back to Activities
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className='p-2 max-w-9xl mx-auto space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='outline' size='icon' onClick={() => router.back()}>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <div>
          <h1 className='text-3xl font-bold'>Edit Activity</h1>
          <p className='text-muted-foreground mt-1'>Update {activity.title}</p>
        </div>
      </div>

      {/* Form */}
      <ActivityForm initialData={activity} />
    </div>
  );
}
