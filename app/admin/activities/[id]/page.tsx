/**
 * Activity Detail Page
 * View complete details of an activity
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Eye, EyeOff, Plus, Loader2, X } from 'lucide-react';
import { useActivity } from '@/hooks/content/use-activities';
import { usePermissions } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { deleteActivity, togglePublishStatus, addGalleryImages, deleteGalleryImage } from '@/app/actions/activities';
import { uploadImage, deleteFile } from '@/lib/services/storage-service';
import { compressImage } from '@/lib/services/image-compression';
import Image from 'next/image';

export default function ActivityDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { hasPermission, profile, loading: permissionsLoading } = usePermissions();
  const { activity, loading, error, refetch } = useActivity(id);

  // Gallery upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user can edit this specific activity
  // Anyone with activities.update permission can edit ANY activity (Super Admin, Activities Coordinator, etc.)
  const hasUpdatePermission = hasPermission('activities', 'update');
  const canUpdate = hasUpdatePermission;

  // Delete permission - anyone with activities.delete permission can delete any activity
  const hasDeletePermission = hasPermission('activities', 'delete');
  const canDelete = hasDeletePermission;

  useEffect(() => {
    if (!permissionsLoading && !hasPermission('activities', 'view')) {
      router.push('/admin/activities');
    }
  }, [hasPermission, permissionsLoading, router]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this activity?')) {
      return;
    }

    const result = await deleteActivity(id);

    if (result.success) {
      toast.success('Activity deleted successfully');
      router.push('/admin/activities');
    } else {
      toast.error(result.message || 'Failed to delete activity');
    }
  };

  const handleTogglePublish = async () => {
    if (!activity) return;

    const result = await togglePublishStatus(id, !activity.is_published);

    if (result.success) {
      toast.success(
        `Activity ${
          activity.is_published ? 'unpublished' : 'published'
        } successfully`
      );
      refetch();
    } else {
      toast.error(result.message || 'Failed to update publish status');
    }
  };

  // Handle gallery image upload
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const invalidFiles = files.filter((file) => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      toast.error('All files must be images');
      return;
    }

    // Validate file sizes (max 10MB each)
    const oversizedFiles = files.filter((file) => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Each image must be less than 10MB');
      return;
    }

    setIsUploading(true);
    const uploadedImages: { image_url: string; caption?: string; alt_text?: string }[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${i + 1} of ${files.length}...`);

        // Compress image before upload
        const compressedFile = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.7,
          maxSizeMB: 2,
          timeoutMs: 15000,
        });

        // Upload to storage
        const url = await uploadImage(compressedFile, 'activity-images', 'gallery');
        uploadedImages.push({ image_url: url });
      }

      // Add images to database
      const result = await addGalleryImages(id, uploadedImages);

      if (result.success) {
        toast.success(`Successfully added ${uploadedImages.length} image(s)`);
        refetch();
      } else {
        toast.error(result.message || 'Failed to add images');
        // Clean up uploaded files if database insert failed
        for (const image of uploadedImages) {
          try {
            await deleteFile(image.image_url, 'activity-images');
          } catch (cleanupError) {
            console.error('Failed to clean up uploaded image:', cleanupError);
          }
        }
      }
    } catch (error) {
      console.error('Gallery upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload images');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle gallery image delete
  const handleDeleteImage = async (imageId: string, imageUrl: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    setDeletingImageId(imageId);

    try {
      // Delete from database first
      const result = await deleteGalleryImage(id, imageId);

      if (result.success) {
        // Then delete from storage
        try {
          await deleteFile(imageUrl, 'activity-images');
        } catch (storageError) {
          console.error('Failed to delete image from storage:', storageError);
          // Don't fail the operation if storage delete fails
        }

        toast.success('Image deleted successfully');
        refetch();
      } else {
        toast.error(result.message || 'Failed to delete image');
      }
    } catch (error) {
      console.error('Delete image error:', error);
      toast.error('Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  };

  if (loading || permissionsLoading) {
    return (
      <div className='p-6 max-w-9xl mx-auto'>
        <Skeleton className='h-12 w-64 mb-6' />
        <Skeleton className='h-96' />
      </div>
    );
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
      <div className='flex items-start justify-between gap-4'>
        <div className='flex items-center gap-4 flex-1'>
          <Button variant='outline' size='icon' onClick={() => router.back()}>
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div className='flex-1'>
            <h1 className='text-3xl font-bold'>{activity.title}</h1>
            <p className='text-muted-foreground mt-1'>{activity.slug}</p>
          </div>
        </div>

        {/* Actions */}
        <div className='flex items-center gap-2'>
          {canUpdate && (
            <>
              <Button variant='outline' onClick={handleTogglePublish}>
                {activity.is_published ? (
                  <>
                    <EyeOff className='h-4 w-4 mr-2' />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Eye className='h-4 w-4 mr-2' />
                    Publish
                  </>
                )}
              </Button>
              <Button
                variant='outline'
                onClick={() => router.push(`/admin/activities/${id}/edit`)}
              >
                <Edit className='h-4 w-4 mr-2' />
                Edit
              </Button>
            </>
          )}
          {canDelete && (
            <Button variant='destructive' onClick={handleDelete}>
              <Trash2 className='h-4 w-4 mr-2' />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className='flex items-center gap-2 flex-wrap'>
        <Badge variant={activity.is_published ? 'default' : 'secondary'}>
          {activity.is_published ? 'Published' : 'Draft'}
        </Badge>
        <Badge variant='outline'>{activity.status}</Badge>
        <Badge variant='outline'>{activity.category}</Badge>
        <Badge variant='outline'>{activity.progress}% Complete</Badge>
      </div>

      {/* Hero Image */}
      <Card>
        <CardContent className='p-0'>
          <div className='aspect-video bg-muted'>
            <Image
              src={activity.hero_image_url}
              alt={activity.title}
              className='w-full h-full object-cover'
              width={1000}
              height={1000}
            />
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='whitespace-pre-wrap'>{activity.description}</p>
        </CardContent>
      </Card>

      {/* Vision */}
      {activity.vision_text && (
        <Card>
          <CardHeader>
            <CardTitle>Vision</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='whitespace-pre-wrap'>{activity.vision_text}</p>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      {activity.metrics && activity.metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              {activity.metrics.map((metric) => (
                <div
                  key={metric.id}
                  className='flex justify-between p-3 bg-muted rounded'
                >
                  <span className='font-medium'>{metric.metric_key}</span>
                  <span>{metric.metric_value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Stats */}
      {activity.impact_stats && activity.impact_stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Impact Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
              {activity.impact_stats.map((stat) => (
                <div key={stat.id} className='p-4 bg-muted rounded text-center'>
                  <div className='text-2xl font-bold'>{stat.value}</div>
                  <div className='text-sm text-muted-foreground mt-1'>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gallery */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Gallery</CardTitle>
          {canUpdate && (
            <div className='flex items-center gap-2'>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                multiple
                className='hidden'
                onChange={handleGalleryUpload}
                disabled={isUploading}
              />
              <Button
                variant='outline'
                size='sm'
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    {uploadProgress || 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Plus className='h-4 w-4 mr-2' />
                    Add Images
                  </>
                )}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {activity.gallery && activity.gallery.length > 0 ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
              {activity.gallery.map((image) => (
                <div key={image.id} className='space-y-2 group relative'>
                  <div className='aspect-video bg-muted rounded overflow-hidden relative'>
                    <Image
                      src={image.image_url}
                      alt={image.alt_text || image.caption || 'Gallery image'}
                      className='w-full h-full object-cover'
                      width={300}
                      height={300}
                    />
                    {/* Delete button overlay */}
                    {canUpdate && (
                      <Button
                        variant='destructive'
                        size='icon'
                        className='absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity'
                        onClick={() => handleDeleteImage(image.id, image.image_url)}
                        disabled={deletingImageId === image.id}
                      >
                        {deletingImageId === image.id ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          <X className='h-4 w-4' />
                        )}
                      </Button>
                    )}
                  </div>
                  {image.caption && (
                    <p className='text-sm text-muted-foreground'>
                      {image.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-8 text-muted-foreground'>
              <p className='text-sm'>No gallery images yet</p>
              {canUpdate && (
                <p className='text-xs mt-1'>Click "Add Images" to upload photos</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Testimonials */}
      {activity.testimonials && activity.testimonials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Testimonials</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {activity.testimonials.map((testimonial) => (
              <div key={testimonial.id} className='p-4 bg-muted rounded'>
                <p className='italic mb-3'>"{testimonial.content}"</p>
                <div className='flex items-center gap-3'>
                  {testimonial.author_avatar_url && (
                    <Image
                      src={testimonial.author_avatar_url}
                      alt={testimonial.author_name}
                      className='w-10 h-10 rounded-full object-cover'
                      width={40}
                      height={40}
                    />
                  )}
                  <div>
                    <div className='font-medium'>{testimonial.author_name}</div>
                    {testimonial.author_role && (
                      <div className='text-sm text-muted-foreground'>
                        {testimonial.author_role}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle>SEO Information</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {activity.meta_title && (
            <div>
              <div className='text-sm font-medium'>Meta Title</div>
              <div className='text-muted-foreground'>{activity.meta_title}</div>
            </div>
          )}
          {activity.meta_description && (
            <div>
              <div className='text-sm font-medium'>Meta Description</div>
              <div className='text-muted-foreground'>
                {activity.meta_description}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
