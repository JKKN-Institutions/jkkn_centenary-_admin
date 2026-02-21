/**
 * UserAssignmentSelector Component
 * Allows admins to assign activities to users based on institution/department
 */

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Building2, GraduationCap, User } from 'lucide-react'
import { getUsersForAssignment } from '@/app/actions/activities'
import { useUserProfile } from '@/lib/permissions'

interface Institution {
  id: string
  name: string
}

interface Department {
  id: string
  name: string
  institution_id: string
}

interface AssignableUser {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  designation: string | null
  institution_id: string | null
  department_id: string | null
  institution: { id: string; name: string } | null
  department: { id: string; name: string } | null
}

interface UserAssignmentSelectorProps {
  institutionId?: string
  departmentId?: string
  assignedTo?: string
  onInstitutionChange?: (institutionId: string | undefined) => void
  onDepartmentChange?: (departmentId: string | undefined) => void
  onAssignedUserChange?: (userId: string | undefined) => void
  disabled?: boolean
}

export function UserAssignmentSelector({
  institutionId,
  departmentId,
  assignedTo,
  onInstitutionChange,
  onDepartmentChange,
  onAssignedUserChange,
  disabled = false,
}: UserAssignmentSelectorProps) {
  const { profile } = useUserProfile()
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<AssignableUser[]>([])
  const [loading, setLoading] = useState(false)

  const isSuperAdmin = profile?.role_type === 'super_admin'

  // Fetch institutions (only for super admins)
  useEffect(() => {
    if (!isSuperAdmin) return

    const fetchInstitutions = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('institutions')
        .select('id, name')
        .order('name', { ascending: true })

      setInstitutions(data || [])
    }

    fetchInstitutions()
  }, [isSuperAdmin])

  // Fetch departments (filtered by institution)
  useEffect(() => {
    const fetchDepartments = async () => {
      const supabase = createClient()

      // Determine which institution to filter by
      const selectedInstitution = isSuperAdmin ? institutionId : profile?.institution_id

      // For super admins, require institution selection before fetching departments
      if (isSuperAdmin && !selectedInstitution) {
        setDepartments([])
        return
      }

      let query = supabase
        .from('departments')
        .select('id, name, institution_id')
        .order('name', { ascending: true })

      // Filter by institution
      if (selectedInstitution) {
        query = query.eq('institution_id', selectedInstitution)
      }

      const { data } = await query
      setDepartments(data || [])
    }

    fetchDepartments()
  }, [institutionId, profile?.institution_id, isSuperAdmin])

  // Fetch assignable users
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)

      const filters: { institution_id?: string; department_id?: string } = {}

      // For super admins, filter by selected institution
      // For non-super-admins, pass the activity's institution context
      // so coordinators with null profile institution can still see users
      if (institutionId) {
        filters.institution_id = institutionId
      }

      if (departmentId) {
        filters.department_id = departmentId
      }

      const result = await getUsersForAssignment(filters)

      if (result.success) {
        setUsers(result.data)
      }

      setLoading(false)
    }

    fetchUsers()
  }, [institutionId, departmentId, isSuperAdmin])

  // Handle institution change
  const handleInstitutionChange = (value: string) => {
    const newValue = value === 'none' ? undefined : value
    onInstitutionChange?.(newValue)

    // Reset department and user when institution changes
    onDepartmentChange?.(undefined)
    onAssignedUserChange?.(undefined)
  }

  // Handle department change
  const handleDepartmentChange = (value: string) => {
    const newValue = value === 'none' ? undefined : value
    onDepartmentChange?.(newValue)

    // Reset user when department changes
    onAssignedUserChange?.(undefined)
  }

  // Handle user assignment change
  const handleUserChange = (value: string) => {
    const newValue = value === 'none' ? undefined : value
    onAssignedUserChange?.(newValue)
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <User className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Activity Assignment</h3>
      </div>

      {/* Institution Selector (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="space-y-2">
          <Label htmlFor="institution">Institution</Label>
          <Select
            value={institutionId || 'none'}
            onValueChange={handleInstitutionChange}
            disabled={disabled}
          >
            <SelectTrigger id="institution">
              <SelectValue placeholder="Select institution (optional)">
                {institutionId ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {institutions.find(i => i.id === institutionId)?.name}
                  </div>
                ) : (
                  <span className="text-muted-foreground">All institutions</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">All institutions</span>
              </SelectItem>
              {institutions.map((institution) => (
                <SelectItem key={institution.id} value={institution.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {institution.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Department Selector */}
      <div className="space-y-2">
        <Label htmlFor="department">Department</Label>
        <Select
          value={departmentId || 'none'}
          onValueChange={handleDepartmentChange}
          disabled={disabled || (isSuperAdmin && !institutionId) || departments.length === 0}
        >
          <SelectTrigger id="department">
            <SelectValue placeholder={isSuperAdmin && !institutionId ? "Select institution first" : "Select department (optional)"}>
              {departmentId ? (
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  {departments.find(d => d.id === departmentId)?.name}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {isSuperAdmin && !institutionId ? 'Select institution first' : 'All departments'}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">All departments</span>
            </SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  {department.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSuperAdmin && !institutionId && (
          <p className="text-xs text-muted-foreground">
            Please select an institution first to see available departments
          </p>
        )}
      </div>

      {/* User Selector */}
      <div className="space-y-2">
        <Label htmlFor="assigned_to">Assign To</Label>
        <Select
          value={assignedTo || 'none'}
          onValueChange={handleUserChange}
          disabled={disabled || loading}
        >
          <SelectTrigger id="assigned_to">
            <SelectValue placeholder="Select user (optional)">
              {assignedTo ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={users.find(u => u.id === assignedTo)?.avatar_url || undefined}
                    />
                    <AvatarFallback className="text-xs">
                      {users.find(u => u.id === assignedTo)?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{users.find(u => u.id === assignedTo)?.full_name || users.find(u => u.id === assignedTo)?.email}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">Unassigned</span>
            </SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.full_name || user.email}</span>
                    {user.designation && (
                      <span className="text-xs text-muted-foreground">{user.designation}</span>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loading && (
          <p className="text-xs text-muted-foreground">Loading users...</p>
        )}

        {!loading && users.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No users available for assignment. {isSuperAdmin ? 'Try selecting an institution first.' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
