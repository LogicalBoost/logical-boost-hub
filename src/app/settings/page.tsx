'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/demo-toast'
import type { UserRole } from '@/types/database'

interface TeamMember {
  id: string
  email: string
  name: string | null
  role: UserRole
  status: 'active' | 'disabled'
  client_id: string | null
  created_at: string
}

interface ClientAssignment {
  id: string
  user_id: string
  client_id: string
}

export default function SettingsPage() {
  const { profile, user } = useAuth()
  const { allClients, canEdit } = useAppStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'clients'>('profile')

  // Profile form
  const [editName, setEditName] = useState(profile?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Team management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<ClientAssignment[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('team_editor')
  const [inviting, setInviting] = useState(false)

  // Manage assignments modal
  const [managingMember, setManagingMember] = useState<TeamMember | null>(null)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    setEditName(profile?.name || '')
  }, [profile])

  useEffect(() => {
    if (isAdmin) {
      loadTeam()
    }
  }, [isAdmin])

  async function loadTeam() {
    setLoadingTeam(true)
    const [{ data: members }, { data: assigns }] = await Promise.all([
      supabase.from('users').select('*').order('created_at'),
      supabase.from('client_assignments').select('*'),
    ])
    setTeamMembers((members || []) as TeamMember[])
    setAssignments((assigns || []) as ClientAssignment[])
    setLoadingTeam(false)
  }

  async function handleSaveProfile() {
    if (!user || !editName.trim()) return
    setSavingProfile(true)
    const { error } = await supabase
      .from('users')
      .update({ name: editName.trim() })
      .eq('id', user.id)
    setSavingProfile(false)
    if (error) {
      showToast('Failed to save: ' + error.message)
    } else {
      showToast('Profile updated')
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)

    // Create the auth user via Supabase admin (using service role from edge function)
    // For now, we'll create the user profile entry directly.
    // The user will need to sign up themselves, then admin assigns role.

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', inviteEmail.trim())
      .single()

    if (existing) {
      showToast('User with this email already exists')
      setInviting(false)
      return
    }

    // Sign up the user (they'll get a confirmation email)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: inviteEmail.trim(),
      password: crypto.randomUUID().slice(0, 12), // Temp password, user will reset
      options: {
        data: { name: inviteName.trim() || inviteEmail.split('@')[0] },
      },
    })

    if (authError) {
      showToast('Failed to invite: ' + authError.message)
      setInviting(false)
      return
    }

    if (authData.user) {
      // Create the user profile with the assigned role
      await supabase.from('users').insert({
        id: authData.user.id,
        email: inviteEmail.trim(),
        name: inviteName.trim() || inviteEmail.split('@')[0],
        role: inviteRole,
        status: 'active',
      })
    }

    showToast('Team member invited! They will receive a confirmation email.')
    setInviteEmail('')
    setInviteName('')
    setShowInviteForm(false)
    setInviting(false)
    loadTeam()
  }

  async function handleChangeRole(memberId: string, newRole: UserRole) {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', memberId)
    if (error) {
      showToast('Failed to update role: ' + error.message)
    } else {
      showToast('Role updated')
      loadTeam()
    }
  }

  async function handleToggleStatus(member: TeamMember) {
    const newStatus = member.status === 'active' ? 'disabled' : 'active'
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', member.id)
    if (error) {
      showToast('Failed to update status')
    } else {
      showToast(`User ${newStatus === 'active' ? 'enabled' : 'disabled'}`)
      loadTeam()
    }
  }

  async function handleAssignClient(memberId: string, clientId: string) {
    const exists = assignments.some(a => a.user_id === memberId && a.client_id === clientId)
    if (exists) {
      // Remove assignment
      const { error } = await supabase
        .from('client_assignments')
        .delete()
        .eq('user_id', memberId)
        .eq('client_id', clientId)
      if (error) {
        showToast('Failed to remove assignment')
      } else {
        showToast('Client unassigned')
        loadTeam()
      }
    } else {
      // Add assignment
      const { error } = await supabase
        .from('client_assignments')
        .insert({ user_id: memberId, client_id: clientId })
      if (error) {
        showToast('Failed to assign client: ' + error.message)
      } else {
        showToast('Client assigned')
        loadTeam()
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Account, team management, and preferences</p>
      </div>

      {/* Tabs */}
      <div className="funnel-tabs" style={{ marginBottom: 24 }}>
        <button
          className={`funnel-tab ${activeTab === 'profile' ? 'funnel-tab-active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          My Profile
        </button>
        {isAdmin && (
          <>
            <button
              className={`funnel-tab ${activeTab === 'team' ? 'funnel-tab-active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              Team Members
            </button>
            <button
              className={`funnel-tab ${activeTab === 'clients' ? 'funnel-tab-active' : ''}`}
              onClick={() => setActiveTab('clients')}
            >
              Client Access
            </button>
          </>
        )}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="funnel-section-card">
          <div className="funnel-section-header">
            <h3>My Profile</h3>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  value={profile?.email || ''}
                  disabled
                  style={{ opacity: 0.6 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <div style={{ padding: '8px 0' }}>
                  <span className="tag" style={{ fontSize: 13 }}>{profile?.role || 'admin'}</span>
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              style={{ marginTop: 12 }}
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Team Tab (admin only) */}
      {activeTab === 'team' && isAdmin && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
            </div>
            <button className="btn btn-primary" onClick={() => setShowInviteForm(true)}>
              + Invite Team Member
            </button>
          </div>

          {loadingTeam ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading team...</div>
          ) : (
            <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
              {teamMembers.map(member => (
                <div key={member.id} className="card" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 20px', opacity: member.status === 'disabled' ? 0.5 : 1,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      {member.name || 'Unnamed'}
                      {member.id === user?.id && (
                        <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 8 }}>(you)</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{member.email}</div>
                    <div style={{ marginTop: 4 }}>
                      <span className="tag" style={{ fontSize: 11 }}>{member.role}</span>
                      {member.status === 'disabled' && (
                        <span className="tag" style={{ fontSize: 11, background: '#ef4444', marginLeft: 4 }}>disabled</span>
                      )}
                    </div>
                  </div>
                  {member.id !== user?.id && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={member.role}
                        onChange={e => handleChangeRole(member.id, e.target.value as UserRole)}
                        className="form-input"
                        style={{ fontSize: 12, padding: '4px 8px', minWidth: 120 }}
                      >
                        <option value="admin">Admin</option>
                        <option value="team_editor">Team Editor</option>
                        <option value="team_viewer">Team Viewer</option>
                        <option value="client">Client</option>
                      </select>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setManagingMember(member)}
                      >
                        Clients
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => handleToggleStatus(member)}
                      >
                        {member.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Invite Modal */}
          {showInviteForm && (
            <div className="modal-overlay" onClick={() => setShowInviteForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                <div className="modal-header">
                  <h2 className="modal-title">Invite Team Member</h2>
                  <button className="modal-close" onClick={() => setShowInviteForm(false)}>&times;</button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleInviteMember}>
                    <div className="form-group">
                      <label className="form-label">Email *</label>
                      <input
                        className="form-input"
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="team@example.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input
                        className="form-input"
                        value={inviteName}
                        onChange={e => setInviteName(e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select
                        className="form-input"
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as UserRole)}
                      >
                        <option value="admin">Admin (full access)</option>
                        <option value="team_editor">Team Editor (edit assigned clients)</option>
                        <option value="team_viewer">Team Viewer (read-only)</option>
                        <option value="client">Client (own data only)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowInviteForm(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={inviting}>
                        {inviting ? 'Inviting...' : 'Send Invite'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Client Assignment Modal */}
          {managingMember && (
            <div className="modal-overlay" onClick={() => setManagingMember(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                <div className="modal-header">
                  <h2 className="modal-title">Assign Clients to {managingMember.name || managingMember.email}</h2>
                  <button className="modal-close" onClick={() => setManagingMember(null)}>&times;</button>
                </div>
                <div className="modal-body">
                  {allClients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      No clients created yet.
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                        Toggle which clients this team member can access:
                      </p>
                      {allClients.map(c => {
                        const isAssigned = assignments.some(
                          a => a.user_id === managingMember.id && a.client_id === c.id
                        )
                        return (
                          <label
                            key={c.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                              border: '1px solid var(--border)', marginBottom: 6,
                              background: isAssigned ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => handleAssignClient(managingMember.id, c.id)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                              {c.website && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.website}</div>}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Client Access Tab */}
      {activeTab === 'clients' && isAdmin && (
        <div className="funnel-section-card">
          <div className="funnel-section-header">
            <h3>Client Access Map</h3>
          </div>
          <div style={{ padding: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Overview of which team members have access to each client.
            </p>
            {allClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No clients created yet.
              </div>
            ) : (
              <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
                {allClients.map(c => {
                  const clientAssignments = assignments.filter(a => a.client_id === c.id)
                  const assignedMembers = teamMembers.filter(m =>
                    clientAssignments.some(a => a.user_id === m.id)
                  )
                  const admins = teamMembers.filter(m => m.role === 'admin')
                  return (
                    <div key={c.id} className="card" style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{c.name}</div>
                      <div className="tag-list">
                        {admins.map(a => (
                          <span key={a.id} className="tag" style={{ fontSize: 11 }}>
                            {a.name || a.email} (admin)
                          </span>
                        ))}
                        {assignedMembers.map(m => (
                          <span key={m.id} className="tag" style={{ fontSize: 11 }}>
                            {m.name || m.email} ({m.role})
                          </span>
                        ))}
                        {assignedMembers.length === 0 && admins.length === 0 && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No team members assigned</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
