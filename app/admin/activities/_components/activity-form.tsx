/**
 * Activity Form Component
 * Comprehensive form for creating and editing activities
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Save, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { CreateActivitySchema, type CreateActivityInput } from '@/types/activity'
import type { Activity } from '@/types/activity'
import { createActivity, updateActivity } from '@/app/actions/activities'
import { useCategorySummaries } from '@/hooks/content/use-activity-categories'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImageUpload } from './image-upload'
import { MetricsEditor } from './metrics-editor'
import { StatsEditor } from './stats-editor'
import { GalleryEditor } from './gallery-editor'
import { TestimonialsEditor } from './testimonials-editor'
import { UserAssignmentSelector } from './user-assignment-selector'

interface ActivityFormProps {
  initialData?: Activity
}

export function ActivityForm({ initialData }: ActivityFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [heroImageUrl, setHeroImageUrl] = useState<string>(
    initialData?.hero_image_url || ''
  )
  const [currentTab, setCurrentTab] = useState<string>('basic')

  // Assignment state
  const [institutionId, setInstitutionId] = useState<string | undefined>(
    initialData?.institution_id || undefined
  )
  const [departmentId, setDepartmentId] = useState<string | undefined>(
    initialData?.department_id || undefined
  )
  const [assignedTo, setAssignedTo] = useState<string | undefined>(
    initialData?.assigned_to || undefined
  )

  const isEditMode = !!initialData

  // Define tab order
  const tabs = ['basic', 'content', 'media', 'data', 'seo']
  const currentTabIndex = tabs.indexOf(currentTab)
  const isFirstTab = currentTabIndex === 0
  const isLastTab = currentTabIndex === tabs.length - 1

  // Fetch active categories
  const { summaries: categories, loading: categoriesLoading } = useCategorySummaries(true)

  // Initialize form with default values
  const form = useForm<CreateActivityInput>({
    resolver: zodResolver(CreateActivitySchema) as any,
    defaultValues: {
      // Basic Info
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      status: initialData?.status || 'planned',
      category: initialData?.category || 'community',
      activity_date: initialData?.activity_date || '',
      progress: initialData?.progress ?? 0,
      impact: initialData?.impact || '',

      // Content
      description: initialData?.description || '',
      vision_text: initialData?.vision_text || '',

      // Media
      hero_image_url: initialData?.hero_image_url || '',

      // Nested Data
      metrics: initialData?.metrics || [],
      impact_stats: initialData?.impact_stats || [],
      gallery: initialData?.gallery || [],
      testimonials: initialData?.testimonials || [],

      // SEO
      meta_title: initialData?.meta_title || '',
      meta_description: initialData?.meta_description || '',

      // Publishing
      is_published: initialData?.is_published ?? false,
      display_order: initialData?.display_order ?? 0,

      // Assignment (NEW)
      institution_id: initialData?.institution_id || undefined,
      department_id: initialData?.department_id || undefined,
      assigned_to: initialData?.assigned_to || undefined,
    },
  })

  // Auto-generate slug from title
  const handleTitleChange = (title: string) => {
    if (!isEditMode || !initialData?.slug) {
      const slug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      form.setValue('slug', slug)
    }
  }

  // Navigate to next tab (with validation)
  const handleNext = async () => {
    if (isLastTab) return

    // Validate current tab fields before moving to next
    let fieldsToValidate: (keyof CreateActivityInput)[] = []

    switch (currentTab) {
      case 'basic':
        fieldsToValidate = ['title', 'slug', 'status', 'category']
        break
      case 'content':
        fieldsToValidate = ['description']
        break
      case 'media':
        // Skip hero_image validation - allow draft without image
        break
      case 'data':
        // No required fields
        break
      case 'seo':
        // No required fields
        break
    }

    // Trigger validation for current tab fields
    if (fieldsToValidate.length > 0) {
      const result = await form.trigger(fieldsToValidate)
      if (!result) {
        toast.error('Please fix errors before continuing')
        return
      }
    }

    // Move to next tab
    setCurrentTab(tabs[currentTabIndex + 1])

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Navigate to previous tab
  const handleBack = () => {
    if (!isFirstTab) {
      setCurrentTab(tabs[currentTabIndex - 1])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handle form submission
  const onSubmit = async (data: CreateActivityInput) => {
    console.log('========================================')
    console.log('[ActivityForm] Form submission started')
    console.log('[ActivityForm] Form data:', data)
    console.log('[ActivityForm] Is edit mode:', isEditMode)
    console.log('========================================')

    startTransition(async () => {
      try {
        console.log('[ActivityForm] Starting transition...')

        // Prepare FormData
        const formData = new FormData()

        console.log('[ActivityForm] Processing basic fields...')
        // Basic fields
        Object.entries(data).forEach(([key, value]) => {
          if (value !== null && value !== undefined && typeof value !== 'object') {
            console.log(`[ActivityForm] Adding field ${key}:`, value)
            formData.append(key, value.toString())
          }
        })

        // Handle nested arrays as JSON
        console.log('[ActivityForm] Processing nested data...')
        if (data.metrics && data.metrics.length > 0) {
          console.log('[ActivityForm] Adding metrics:', data.metrics.length, 'items')
          formData.append('metrics', JSON.stringify(data.metrics))
        }
        if (data.impact_stats && data.impact_stats.length > 0) {
          console.log('[ActivityForm] Adding impact_stats:', data.impact_stats.length, 'items')
          formData.append('impact_stats', JSON.stringify(data.impact_stats))
        }
        if (data.gallery && data.gallery.length > 0) {
          console.log('[ActivityForm] Adding gallery:', data.gallery.length, 'items')
          formData.append('gallery', JSON.stringify(data.gallery))
        }
        if (data.testimonials && data.testimonials.length > 0) {
          console.log('[ActivityForm] Adding testimonials:', data.testimonials.length, 'items')
          formData.append('testimonials', JSON.stringify(data.testimonials))
        }

        // Add assignment fields (NEW)
        console.log('[ActivityForm] Adding assignment fields...')
        if (institutionId) {
          console.log('[ActivityForm] Adding institution_id:', institutionId)
          formData.append('institution_id', institutionId)
        }
        if (departmentId) {
          console.log('[ActivityForm] Adding department_id:', departmentId)
          formData.append('department_id', departmentId)
        }
        if (assignedTo) {
          console.log('[ActivityForm] Adding assigned_to:', assignedTo)
          formData.append('assigned_to', assignedTo)
        }

        // Add activity ID for edit mode
        if (isEditMode && initialData?.id) {
          console.log('[ActivityForm] Adding activity ID for edit:', initialData.id)
          formData.append('id', initialData.id)
        }

        // Log all FormData entries
        console.log('[ActivityForm] FormData contents:')
        for (const [key, value] of formData.entries()) {
          console.log(`  ${key}:`, typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : value)
        }

        // Call server action
        console.log('[ActivityForm] Calling server action...')
        const result = isEditMode
          ? await updateActivity({ success: false, message: '' }, formData)
          : await createActivity({ success: false, message: '' }, formData)

        console.log('[ActivityForm] Server action result:', result)

        if (result.success) {
          console.log('[ActivityForm] Success! Showing toast and redirecting...')
          toast.success(
            isEditMode
              ? 'Activity updated successfully'
              : 'Activity created successfully'
          )

          // Redirect based on mode
          if (isEditMode && initialData?.id) {
            console.log('[ActivityForm] Redirecting to:', `/admin/activities/${initialData.id}`)
            router.push(`/admin/activities/${initialData.id}`)
          } else if (result.data?.id) {
            console.log('[ActivityForm] Redirecting to:', `/admin/activities/${result.data.id}`)
            router.push(`/admin/activities/${result.data.id}`)
          } else {
            console.log('[ActivityForm] Redirecting to:', '/admin/activities')
            router.push('/admin/activities')
          }
          router.refresh()
        } else {
          console.error('[ActivityForm] Server action failed:', result.message)
          toast.error(result.message || 'Failed to save activity')
        }
      } catch (error) {
        console.error('[ActivityForm] Submit error:', error)
        console.error('[ActivityForm] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        toast.error('An unexpected error occurred')
      }
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          // IMPORTANT: Only allow form submission when on the last tab (SEO)
          // This prevents accidental submission when pressing Enter in input fields
          if (currentTab !== 'seo') {
            console.log('🟡 FORM SUBMIT BLOCKED - Not on SEO tab, current tab:', currentTab)
            e.preventDefault()
            // Instead of submitting, move to the next tab
            handleNext()
            return
          }

          console.log('🟡 FORM ONSUBMIT EVENT FIRED!')
          console.log('🟡 Event:', e)
          form.handleSubmit(onSubmit)(e)
        }}
        className="space-y-6"
      >
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">1. Basic Info</TabsTrigger>
            <TabsTrigger value="content">2. Content</TabsTrigger>
            <TabsTrigger value="media">3. Media</TabsTrigger>
            <TabsTrigger value="data">4. Data</TabsTrigger>
            <TabsTrigger value="seo">5. SEO</TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Core activity details and categorization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Tree Plantation Drive"
                          value={field.value || ''}
                          onChange={(e) => {
                            field.onChange(e.target.value)
                            handleTitleChange(e.target.value)
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Slug */}
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="tree-plantation-drive"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          disabled={isEditMode}
                        />
                      </FormControl>
                      <FormDescription>
                        URL-friendly identifier (auto-generated, cannot be changed after creation)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Status */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="planned">Planned</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Category */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={categoriesLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={categoriesLoading ? "Loading categories..." : "Select category"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.slug}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the category for this activity
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Activity Date */}
                  <FormField
                    control={form.control}
                    name="activity_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activity Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Progress */}
                  <FormField
                    control={form.control}
                    name="progress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Progress (%)</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value, 10))}
                          value={field.value?.toString() || '0'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select progress" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">0% - Not Started</SelectItem>
                            <SelectItem value="10">10% - Just Started</SelectItem>
                            <SelectItem value="25">25% - Quarter Done</SelectItem>
                            <SelectItem value="50">50% - Half Complete</SelectItem>
                            <SelectItem value="75">75% - Three Quarters</SelectItem>
                            <SelectItem value="90">90% - Nearly Done</SelectItem>
                            <SelectItem value="100">100% - Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Display Order */}
                  <FormField
                    control={form.control}
                    name="display_order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            value={field.value ?? 0}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                              field.onChange(isNaN(value) ? 0 : value)
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormDescription>
                          Higher numbers appear first
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Impact */}
                <FormField
                  control={form.control}
                  name="impact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Impact Summary</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Brief impact statement (max 100 chars)"
                          maxLength={100}
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0}/100 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Assignment Section */}
                <Separator className="my-6" />
                <UserAssignmentSelector
                  institutionId={institutionId}
                  departmentId={departmentId}
                  assignedTo={assignedTo}
                  onInstitutionChange={setInstitutionId}
                  onDepartmentChange={setDepartmentId}
                  onAssignedUserChange={setAssignedTo}
                  disabled={isPending}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
                <CardDescription>
                  Detailed descriptions and vision text
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed description of the activity"
                          className="min-h-[200px]"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0} characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Vision Text */}
                <FormField
                  control={form.control}
                  name="vision_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vision</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Long-term vision and goals for this activity"
                          className="min-h-[150px]"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Hero Image</CardTitle>
                <CardDescription>
                  Main image representing this activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="hero_image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hero Image *</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value || ''}
                          onChange={(url) => {
                            field.onChange(url)
                            setHeroImageUrl(url)
                          }}
                          bucket="activity-images"
                          folder="hero"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gallery</CardTitle>
                <CardDescription>
                  Additional images showcasing the activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="gallery"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <GalleryEditor
                          value={field.value || []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6">
            {/* Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Metrics</CardTitle>
                <CardDescription>
                  Key metrics and measurements for this activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="metrics"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MetricsEditor
                          value={field.value || []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Impact Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Impact Statistics</CardTitle>
                <CardDescription>
                  Quantifiable impact data with visual indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="impact_stats"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <StatsEditor
                          value={field.value || []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Testimonials */}
            <Card>
              <CardHeader>
                <CardTitle>Testimonials</CardTitle>
                <CardDescription>
                  Quotes and feedback from participants or beneficiaries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="testimonials"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <TestimonialsEditor
                          value={field.value || []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SEO Settings</CardTitle>
                <CardDescription>
                  Optimize for search engines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Meta Title */}
                <FormField
                  control={form.control}
                  name="meta_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SEO-optimized title (max 60 chars)"
                          maxLength={60}
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0}/60 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Meta Description */}
                <FormField
                  control={form.control}
                  name="meta_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="SEO-optimized description (max 160 chars)"
                          maxLength={160}
                          className="min-h-[100px]"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0}/160 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
                <CardDescription>
                  Control visibility of this activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="is_published"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Published Status
                        </FormLabel>
                        <FormDescription>
                          Make this activity visible to the public
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Form Actions */}
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!isFirstTab && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isPending}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}

            {!isLastTab ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isPending}
              >
                Save and Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isPending}
                onClick={async (e) => {
                  console.log('🔴 SUBMIT BUTTON CLICKED!')
                  console.log('🔴 Form errors:', form.formState.errors)
                  console.log('🔴 Form is valid:', form.formState.isValid)
                  console.log('🔴 Form values:', form.getValues())
                  console.log('🔴 Is pending:', isPending)

                  // Check if hero image is required but missing
                  const formValues = form.getValues()
                  if (formValues.is_published && !formValues.hero_image_url) {
                    e.preventDefault()
                    toast.error('Hero image is required when publishing an activity')
                    setCurrentTab('media') // Navigate to media tab
                    return
                  }
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditMode ? 'Update Activity' : 'Create Activity'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  )
}
