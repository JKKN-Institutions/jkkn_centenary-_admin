/**
 * Server Actions for Activity Module
 * Handles all mutations (create, update, delete) with cache invalidation
 */

'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  CreateActivitySchema,
  UpdateActivitySchema,
  type CreateActivityInput,
  type UpdateActivityInput,
} from '@/types/activity'

// Form state type for client-side error handling
export type FormState = {
  success?: boolean
  message?: string
  errors?: {
    [key: string]: string[]
  }
  data?: any
}

/**
 * Get current authenticated user
 */
async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized: Please log in to continue')
  }

  return user
}

/**
 * Create new activity
 *
 * @param prevState - Previous form state
 * @param formData - Form data from client
 * @returns Form state with success/error
 */
export async function createActivity(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  console.log('========================================')
  console.log('[createActivity] Server action called')
  console.log('[createActivity] Environment:', process.env.NODE_ENV)
  console.log('[createActivity] Timestamp:', new Date().toISOString())
  console.log('========================================')

  try {
    console.log('[createActivity] Step 1: Getting authenticated user...')

    // Enhanced debugging for production
    const supabaseForAuth = await createClient()

    // First, check if we have a session at all
    const { data: sessionData, error: sessionError } = await supabaseForAuth.auth.getSession()
    console.log('[createActivity] Session check:', {
      hasSession: !!sessionData?.session,
      sessionError: sessionError?.message || null,
      accessTokenExists: !!sessionData?.session?.access_token,
      userId: sessionData?.session?.user?.id || 'NO_USER_IN_SESSION',
      userEmail: sessionData?.session?.user?.email || 'NO_EMAIL',
    })

    if (sessionError) {
      console.error('[createActivity] Session error:', sessionError)
    }

    // Now get the user
    const { data: { user }, error: userError } = await supabaseForAuth.auth.getUser()

    console.log('[createActivity] getUser result:', {
      hasUser: !!user,
      userError: userError?.message || null,
      userId: user?.id || 'NO_USER',
      userEmail: user?.email || 'NO_EMAIL',
    })

    if (userError) {
      console.error('[createActivity] CRITICAL: Auth error in production!')
      console.error('[createActivity] Error details:', userError)
      return {
        success: false,
        message: `Authentication failed: ${userError.message}. Please try logging out and back in.`,
      }
    }

    if (!user) {
      console.error('[createActivity] CRITICAL: No user found despite no error!')
      console.error('[createActivity] This indicates a session/cookie issue in production')
      return {
        success: false,
        message: 'Session expired. Please refresh the page and try again.',
      }
    }

    console.log('[createActivity] User authenticated:', user.id, user.email)

    console.log('[createActivity] Step 2: Parsing form data...')
    // Log all form data entries
    console.log('[createActivity] FormData entries:')
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}:`, typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : value)
    }

    // Parse form data
    const rawData = {
      title: formData.get('title'),
      slug: formData.get('slug') || undefined,
      status: formData.get('status'),
      category: formData.get('category'),
      description: formData.get('description'),
      vision_text: formData.get('vision_text') || undefined,
      hero_image_url: formData.get('hero_image_url') || '',
      progress: Number(formData.get('progress')) || 0,
      impact: formData.get('impact') || undefined,
      activity_date: formData.get('activity_date') || undefined,
      is_published: formData.get('is_published') === 'true',
      display_order: Number(formData.get('display_order')) || 0,
      meta_title: formData.get('meta_title') || undefined,
      meta_description: formData.get('meta_description') || undefined,
      // Assignment fields (NEW)
      institution_id: formData.get('institution_id') || undefined,
      department_id: formData.get('department_id') || undefined,
      assigned_to: formData.get('assigned_to') || undefined,
      // Nested data (JSON strings)
      metrics: formData.get('metrics')
        ? JSON.parse(formData.get('metrics') as string)
        : [],
      impact_stats: formData.get('impact_stats')
        ? JSON.parse(formData.get('impact_stats') as string)
        : [],
      gallery: formData.get('gallery')
        ? JSON.parse(formData.get('gallery') as string)
        : [],
      testimonials: formData.get('testimonials')
        ? JSON.parse(formData.get('testimonials') as string)
        : [],
    }

    console.log('[createActivity] Raw data parsed:', {
      title: rawData.title,
      slug: rawData.slug,
      status: rawData.status,
      category: rawData.category,
      metricsCount: rawData.metrics.length,
      statsCount: rawData.impact_stats.length,
      galleryCount: rawData.gallery.length,
      testimonialsCount: rawData.testimonials.length,
    })

    console.log('[createActivity] Step 3: Validating with Zod schema...')
    // Validate with Zod
    const validation = CreateActivitySchema.safeParse(rawData)
    console.log('[createActivity] Validation result:', validation.success ? 'SUCCESS' : 'FAILED')

    if (!validation.success) {
      console.error('[createActivity] Validation failed!')
      console.error('[createActivity] Validation errors:', validation.error.flatten().fieldErrors)
      return {
        success: false,
        errors: validation.error.flatten().fieldErrors,
        message: 'Validation failed. Please check the form for errors.',
      }
    }

    console.log('[createActivity] Validation successful!')
    const validatedData = validation.data

    console.log('[createActivity] Step 4: Getting user profile for institution/department...')
    // Get user's profile to determine institution/department
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_type, role_id, institution_id, department_id')
      .eq('id', user.id)
      .single()

    console.log('[createActivity] User profile:', {
      role_type: profile?.role_type,
      role_id: profile?.role_id,
      institution_id: profile?.institution_id,
      department_id: profile?.department_id,
    })

    // Auto-fill institution/department for non-super admins
    const finalData = {
      ...validatedData,
      institution_id: profile?.role_type === 'super_admin'
        ? (validatedData.institution_id || null)
        : (profile?.institution_id || null),
      department_id: profile?.role_type === 'super_admin'
        ? (validatedData.department_id || null)
        : (profile?.department_id || null),
      assigned_to: validatedData.assigned_to || null,
    }

    console.log('[createActivity] Final data with auto-filled fields:', {
      institution_id: finalData.institution_id,
      department_id: finalData.department_id,
      assigned_to: finalData.assigned_to,
    })

    console.log('[createActivity] Step 5: Checking slug uniqueness...')

    // Check if slug already exists
    const { data: existingActivity, error: slugCheckError } = await supabase
      .from('activities')
      .select('id, title, slug')
      .eq('slug', finalData.slug)
      .maybeSingle()

    if (slugCheckError) {
      console.error('[createActivity] Error checking slug:', slugCheckError)
    }

    if (existingActivity) {
      console.error('[createActivity] Slug already exists!', {
        existingId: existingActivity.id,
        existingTitle: existingActivity.title,
        slug: finalData.slug,
      })
      return {
        success: false,
        message: `An activity with the slug "${finalData.slug}" already exists (Title: "${existingActivity.title}"). Please use a different title or modify the slug.`,
        errors: {
          slug: [`Slug "${finalData.slug}" is already in use`],
        },
      }
    }

    console.log('[createActivity] Slug is unique, proceeding...')

    console.log('[createActivity] Step 6: Inserting main activity record...')
    console.log('[createActivity] Activity data to insert:', {
      title: finalData.title,
      slug: finalData.slug,
      status: finalData.status,
      category: finalData.category,
    })

    // Verify user has permission before insert (debugging)
    console.log('[createActivity] Verifying RLS permission for user:', user.id)
    const { data: permCheck } = await supabase.rpc('check_activity_permission', {
      user_id: user.id,
      permission_name: 'create'
    })
    console.log('[createActivity] RLS permission check result:', permCheck)

    if (permCheck === false) {
      console.error('[createActivity] CRITICAL: User does not have create permission!')
      console.error('[createActivity] This is an RLS policy issue. User ID:', user.id)
      console.error('[createActivity] Profile role_type:', profile?.role_type)
      console.error('[createActivity] Profile role_id:', profile?.role_id)
      return {
        success: false,
        message: 'You do not have permission to create activities. Please contact your administrator.',
      }
    }

    // Insert main activity
    console.log('[createActivity] Step 7: Proceeding with INSERT...')
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .insert([
        {
          title: finalData.title,
          slug: finalData.slug,
          status: finalData.status,
          category: finalData.category,
          description: finalData.description,
          vision_text: finalData.vision_text || null,
          hero_image_url: finalData.hero_image_url || '',
          progress: finalData.progress,
          impact: finalData.impact || null,
          activity_date: finalData.activity_date || null,
          is_published: finalData.is_published,
          display_order: finalData.display_order,
          meta_title: finalData.meta_title || null,
          meta_description: finalData.meta_description || null,
          institution_id: finalData.institution_id,
          department_id: finalData.department_id,
          assigned_to: finalData.assigned_to,
          created_by: user.id,
          updated_by: user.id,
        },
      ])
      .select()
      .single()

    if (activityError) {
      console.error('[createActivity] =============================================')
      console.error('[createActivity] DATABASE INSERT FAILED!')
      console.error('[createActivity] Error message:', activityError.message)
      console.error('[createActivity] Error code:', activityError.code)
      console.error('[createActivity] Error details:', activityError.details)
      console.error('[createActivity] Error hint:', activityError.hint)
      console.error('[createActivity] User ID attempting insert:', user.id)
      console.error('[createActivity] User email:', user.email)
      console.error('[createActivity] =============================================')

      // Check if it's a duplicate key error
      if (activityError.code === '23505' || activityError.message.includes('duplicate key') || activityError.message.includes('unique constraint')) {
        console.error('[createActivity] DUPLICATE KEY ERROR - slug already exists!')
        return {
          success: false,
          message: `An activity with this slug already exists. Please use a different title or modify the slug.`,
          errors: {
            slug: ['This slug is already in use by another activity'],
          },
        }
      }

      // Check if it's an RLS error
      if (activityError.code === '42501' || activityError.message.includes('policy')) {
        return {
          success: false,
          message: 'Permission denied by Row Level Security. Please ensure you have the correct role permissions.',
        }
      }

      return {
        success: false,
        message: `Database error: ${activityError.message}`,
      }
    }

    console.log('[createActivity] Activity inserted successfully! ID:', activity.id)

    // Insert nested data
    const activityId = activity.id
    console.log('[createActivity] Step 8: Inserting nested data...')

    // Insert metrics
    if (validatedData.metrics.length > 0) {
      console.log('[createActivity] Inserting metrics:', validatedData.metrics.length, 'items')
      const { error } = await supabase.from('activity_metrics').insert(
        validatedData.metrics.map((metric, index) => ({
          activity_id: activityId,
          metric_key: metric.metric_key,
          metric_value: metric.metric_value,
          display_order: metric.display_order ?? index,
        }))
      )
      if (error) {
        console.error('[createActivity] Metrics insert error:', error)
      } else {
        console.log('[createActivity] Metrics inserted successfully')
      }
    }

    // Insert impact stats
    if (validatedData.impact_stats.length > 0) {
      console.log('[createActivity] Inserting impact stats:', validatedData.impact_stats.length, 'items')
      const { error } = await supabase.from('activity_impact_stats').insert(
        validatedData.impact_stats.map((stat, index) => ({
          activity_id: activityId,
          label: stat.label,
          value: stat.value,
          icon: stat.icon || null,
          display_order: stat.display_order ?? index,
        }))
      )
      if (error) {
        console.error('[createActivity] Stats insert error:', error)
      } else {
        console.log('[createActivity] Impact stats inserted successfully')
      }
    }

    // Insert gallery
    if (validatedData.gallery.length > 0) {
      console.log('[createActivity] Inserting gallery images:', validatedData.gallery.length, 'items')
      const { error } = await supabase.from('activity_gallery').insert(
        validatedData.gallery.map((image, index) => ({
          activity_id: activityId,
          image_url: image.image_url,
          caption: image.caption || null,
          alt_text: image.alt_text || null,
          display_order: image.display_order ?? index,
        }))
      )
      if (error) {
        console.error('[createActivity] Gallery insert error:', error)
      } else {
        console.log('[createActivity] Gallery inserted successfully')
      }
    }

    // Insert testimonials
    if (validatedData.testimonials.length > 0) {
      console.log('[createActivity] Inserting testimonials:', validatedData.testimonials.length, 'items')
      const { error } = await supabase.from('activity_testimonials').insert(
        validatedData.testimonials.map((testimonial, index) => ({
          activity_id: activityId,
          author_name: testimonial.author_name,
          author_role: testimonial.author_role || null,
          author_avatar_url: testimonial.author_avatar_url || null,
          content: testimonial.content,
          display_order: testimonial.display_order ?? index,
        }))
      )
      if (error) {
        console.error('[createActivity] Testimonials insert error:', error)
      } else {
        console.log('[createActivity] Testimonials inserted successfully')
      }
    }

    console.log('[createActivity] Step 9: Revalidating cache...')
    // Instant cache invalidation
    revalidateTag('activities')
    revalidateTag('activities-list')
    revalidatePath('/admin/activities')
    console.log('[createActivity] Cache revalidated')

    console.log('[createActivity] SUCCESS! Activity created:', activity.id)
    console.log('========================================')

    // Return success with activity data (let client handle redirect)
    return {
      success: true,
      message: 'Activity created successfully',
      data: activity,
    }
  } catch (error) {
    console.error('========================================')
    console.error('[createActivity] CRITICAL ERROR!')
    console.error('[createActivity] Error type:', typeof error)
    console.error('[createActivity] Error:', error)
    console.error('[createActivity] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('========================================')

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Update existing activity
 *
 * @param prevState - Previous form state
 * @param formData - Form data from client
 * @returns Form state with success/error
 */
export async function updateActivity(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    // Get authenticated user
    const user = await getCurrentUser()

    const activityId = formData.get('id') as string

    if (!activityId) {
      return {
        success: false,
        message: 'Activity ID is required',
      }
    }

    // Parse form data (similar to create)
    const rawData = {
      id: activityId,
      title: formData.get('title'),
      slug: formData.get('slug') || undefined,
      status: formData.get('status'),
      category: formData.get('category'),
      description: formData.get('description'),
      vision_text: formData.get('vision_text') || undefined,
      hero_image_url: formData.get('hero_image_url'),
      progress: Number(formData.get('progress')) || 0,
      impact: formData.get('impact') || undefined,
      activity_date: formData.get('activity_date') || undefined,
      is_published: formData.get('is_published') === 'true',
      display_order: Number(formData.get('display_order')) || 0,
      meta_title: formData.get('meta_title') || undefined,
      meta_description: formData.get('meta_description') || undefined,
      // Assignment fields (NEW)
      institution_id: formData.get('institution_id') || undefined,
      department_id: formData.get('department_id') || undefined,
      assigned_to: formData.get('assigned_to') || undefined,
      metrics: formData.get('metrics')
        ? JSON.parse(formData.get('metrics') as string)
        : [],
      impact_stats: formData.get('impact_stats')
        ? JSON.parse(formData.get('impact_stats') as string)
        : [],
      gallery: formData.get('gallery')
        ? JSON.parse(formData.get('gallery') as string)
        : [],
      testimonials: formData.get('testimonials')
        ? JSON.parse(formData.get('testimonials') as string)
        : [],
    }

    // Validate with Zod (partial validation for updates)
    const validation = UpdateActivitySchema.safeParse(rawData)

    if (!validation.success) {
      return {
        success: false,
        errors: validation.error.flatten().fieldErrors,
        message: 'Validation failed. Please check the form for errors.',
      }
    }

    const validatedData = validation.data

    // Update activity in database
    const supabase = await createClient()

    // Get user's profile to determine institution/department
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_type, institution_id, department_id')
      .eq('id', user.id)
      .single()

    // Fetch the existing activity to check permissions
    const { data: existingActivity, error: fetchError } = await supabase
      .from('activities')
      .select('id, assigned_to, institution_id, department_id')
      .eq('id', activityId)
      .single()

    if (fetchError || !existingActivity) {
      console.error('[updateActivity] Activity not found:', fetchError)
      return {
        success: false,
        message: 'Activity not found',
      }
    }

    // Validate user can update this activity
    const canUpdate =
      // User is assigned to this activity
      existingActivity.assigned_to === user.id ||
      // Super admin can update any activity
      profile?.role_type === 'super_admin' ||
      // Regular admin can update activities from their institution
      (existingActivity.institution_id === profile?.institution_id || existingActivity.institution_id === null)

    if (!canUpdate) {
      console.error('[updateActivity] User not authorized to update this activity')
      return {
        success: false,
        message: 'You do not have permission to update this activity',
      }
    }

    // Auto-fill institution/department for non-super admins
    const finalData = {
      ...validatedData,
      institution_id: profile?.role_type === 'super_admin'
        ? (validatedData.institution_id || null)
        : (profile?.institution_id || null),
      department_id: profile?.role_type === 'super_admin'
        ? (validatedData.department_id || null)
        : (profile?.department_id || null),
      assigned_to: validatedData.assigned_to || null,
    }

    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .update({
        title: finalData.title,
        slug: finalData.slug,
        status: finalData.status,
        category: finalData.category,
        description: finalData.description,
        vision_text: finalData.vision_text || null,
        hero_image_url: finalData.hero_image_url,
        progress: finalData.progress,
        impact: finalData.impact || null,
        activity_date: finalData.activity_date || null,
        is_published: finalData.is_published,
        display_order: finalData.display_order,
        meta_title: finalData.meta_title || null,
        meta_description: finalData.meta_description || null,
        institution_id: finalData.institution_id,
        department_id: finalData.department_id,
        assigned_to: finalData.assigned_to,
        updated_by: user.id,
      })
      .eq('id', activityId)
      .select()
      .single()

    if (activityError) {
      console.error('[updateActivity] Database error:', activityError)
      return {
        success: false,
        message: `Database error: ${activityError.message}`,
      }
    }

    // Delete existing nested data
    await supabase.from('activity_metrics').delete().eq('activity_id', activityId)
    await supabase.from('activity_impact_stats').delete().eq('activity_id', activityId)
    await supabase.from('activity_gallery').delete().eq('activity_id', activityId)
    await supabase.from('activity_testimonials').delete().eq('activity_id', activityId)

    // Insert new nested data (same as create)
    if (validatedData.metrics && validatedData.metrics.length > 0) {
      await supabase.from('activity_metrics').insert(
        validatedData.metrics.map((metric, index) => ({
          activity_id: activityId,
          metric_key: metric.metric_key,
          metric_value: metric.metric_value,
          display_order: metric.display_order ?? index,
        }))
      )
    }

    if (validatedData.impact_stats && validatedData.impact_stats.length > 0) {
      await supabase.from('activity_impact_stats').insert(
        validatedData.impact_stats.map((stat, index) => ({
          activity_id: activityId,
          label: stat.label,
          value: stat.value,
          icon: stat.icon || null,
          display_order: stat.display_order ?? index,
        }))
      )
    }

    if (validatedData.gallery && validatedData.gallery.length > 0) {
      await supabase.from('activity_gallery').insert(
        validatedData.gallery.map((image, index) => ({
          activity_id: activityId,
          image_url: image.image_url,
          caption: image.caption || null,
          alt_text: image.alt_text || null,
          display_order: image.display_order ?? index,
        }))
      )
    }

    if (validatedData.testimonials && validatedData.testimonials.length > 0) {
      await supabase.from('activity_testimonials').insert(
        validatedData.testimonials.map((testimonial, index) => ({
          activity_id: activityId,
          author_name: testimonial.author_name,
          author_role: testimonial.author_role || null,
          author_avatar_url: testimonial.author_avatar_url || null,
          content: testimonial.content,
          display_order: testimonial.display_order ?? index,
        }))
      )
    }

    // Instant cache invalidation
    revalidateTag('activities')
    revalidateTag('activities-list')
    revalidateTag(`activity-${activityId}`)
    revalidatePath('/admin/activities')
    revalidatePath(`/admin/activities/${activityId}`)

    console.log('[updateActivity] Activity updated successfully:', activity.id)

    return {
      success: true,
      message: 'Activity updated successfully',
      data: activity,
    }
  } catch (error) {
    console.error('[updateActivity] Unexpected error:', error)

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Delete activity
 *
 * @param activityId - Activity UUID
 * @returns Form state with success/error
 */
export async function deleteActivity(activityId: string): Promise<FormState> {
  try {
    // Get authenticated user
    const user = await getCurrentUser()

    const supabase = await createClient()

    // Fetch existing activity to check permissions
    const { data: existingActivity, error: fetchError } = await supabase
      .from('activities')
      .select('id, title, institution_id, assigned_to')
      .eq('id', activityId)
      .single()

    if (fetchError || !existingActivity) {
      console.error('[deleteActivity] Activity not found:', fetchError)
      return {
        success: false,
        message: 'Activity not found',
      }
    }

    // Fetch user profile to check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role_type, institution_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return {
        success: false,
        message: 'User profile not found',
      }
    }

    // Check if user can delete this activity
    const canDelete =
      // User is assigned to this activity
      existingActivity.assigned_to === user.id ||
      // Super admin can delete any activity
      profile.role_type === 'super_admin' ||
      // Regular admin can delete activities from their institution
      (existingActivity.institution_id === profile.institution_id || existingActivity.institution_id === null)

    if (!canDelete) {
      console.error('[deleteActivity] Permission denied for user:', user.id)
      return {
        success: false,
        message: 'You do not have permission to delete this activity',
      }
    }

    // Delete activity (cascades to all nested data)
    const { error } = await supabase.from('activities').delete().eq('id', activityId)

    if (error) {
      console.error('[deleteActivity] Database error:', error)
      return {
        success: false,
        message: `Failed to delete activity: ${error.message}`,
      }
    }

    // Instant cache invalidation
    revalidateTag('activities')
    revalidateTag('activities-list')
    revalidateTag(`activity-${activityId}`)
    revalidatePath('/admin/activities')

    console.log('[deleteActivity] Activity deleted successfully:', activityId)

    return {
      success: true,
      message: 'Activity deleted successfully',
    }
  } catch (error) {
    console.error('[deleteActivity] Unexpected error:', error)

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Get users available for activity assignment
 *
 * @param filters - Optional filters (institution_id, department_id)
 * @returns List of users that can be assigned to activities
 */
export async function getUsersForAssignment(filters?: {
  institution_id?: string
  department_id?: string
}) {
  try {
    // Get authenticated user
    const user = await getCurrentUser()
    const supabase = await createClient()

    // Get user's profile to determine access level
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_type, institution_id, department_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Profile not found')
    }

    // Build query
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, designation, institution_id, department_id, institutions(id, name), departments(id, name)')
      .eq('status', 'active') // Only active users
      .order('full_name', { ascending: true })

    // Apply institution filter based on role
    if (profile.role_type === 'super_admin') {
      // Super admin can see users from any institution
      if (filters?.institution_id) {
        query = query.eq('institution_id', filters.institution_id)
      }
    } else {
      // Regular admins can only see users from their own institution
      if (profile.institution_id) {
        query = query.eq('institution_id', profile.institution_id)
      } else {
        // If admin has no institution, return empty list
        return { success: true, data: [] }
      }
    }

    // Apply department filter if provided
    if (filters?.department_id) {
      query = query.eq('department_id', filters.department_id)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('[getUsersForAssignment] Database error:', error)
      return {
        success: false,
        message: `Failed to fetch users: ${error.message}`,
        data: [],
      }
    }

    // Format users for select dropdown
    const formattedUsers = (users || []).map((user: any) => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      avatar_url: user.avatar_url,
      designation: user.designation,
      institution_id: user.institution_id,
      department_id: user.department_id,
      institution: user.institutions && typeof user.institutions === 'object' && !Array.isArray(user.institutions) ? {
        id: user.institutions.id,
        name: user.institutions.name,
      } : null,
      department: user.departments && typeof user.departments === 'object' && !Array.isArray(user.departments) ? {
        id: user.departments.id,
        name: user.departments.name,
      } : null,
    }))

    return {
      success: true,
      data: formattedUsers,
    }
  } catch (error) {
    console.error('[getUsersForAssignment] Unexpected error:', error)

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
        data: [],
      }
    }

    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      data: [],
    }
  }
}

/**
 * Toggle publish status
 *
 * @param activityId - Activity UUID
 * @param isPublished - New publish status
 * @returns Form state with success/error
 */
export async function togglePublishStatus(
  activityId: string,
  isPublished: boolean
): Promise<FormState> {
  try {
    // Get authenticated user
    const user = await getCurrentUser()

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('activities')
      .update({
        is_published: isPublished,
        updated_by: user.id,
      })
      .eq('id', activityId)
      .select()
      .single()

    if (error) {
      console.error('[togglePublishStatus] Database error:', error)
      return {
        success: false,
        message: `Failed to update publish status: ${error.message}`,
      }
    }

    // Instant cache invalidation
    revalidateTag('activities')
    revalidateTag('activities-list')
    revalidateTag(`activity-${activityId}`)
    revalidatePath('/admin/activities')
    revalidatePath(`/admin/activities/${activityId}`)

    console.log('[togglePublishStatus] Publish status updated:', activityId, isPublished)

    return {
      success: true,
      message: `Activity ${isPublished ? 'published' : 'unpublished'} successfully`,
      data,
    }
  } catch (error) {
    console.error('[togglePublishStatus] Unexpected error:', error)

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}
