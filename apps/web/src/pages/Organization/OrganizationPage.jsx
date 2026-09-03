import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrganization,
  listMembers,
  inviteMember,
  changeMemberRole,
  updatePrivacySettings
} from "../../api/endpoints/orgs.js";
import { useAuth } from "../../hooks/useAuth.js";
import { Card } from "../../components/ui/Card.jsx";
import { Table } from "../../components/ui/Table.jsx";
import { Input } from "../../components/ui/Input.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { ROLES } from "../../types/index.js";

const memberColumns = (isAdmin, onRoleChange) => [
  { key: "email", label: "Email", render: (row) => row.user.email },
  { key: "fullName", label: "Name", render: (row) => row.user.fullName },
  {
    key: "role",
    label: "Role",
    render: (row) =>
      isAdmin ? (
        <select value={row.role} onChange={(e) => onRoleChange(row.userId, e.target.value)}>
          {Object.values(ROLES).map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      ) : (
        row.role
      )
  },
  { key: "createdAt", label: "Member since", render: (row) => new Date(row.createdAt).toLocaleDateString() }
];

// The one admin control surface for organization/user/role visibility
// that Phase 8 asks for — built on the org/membership APIs that already
// existed (Day 4), just never had a frontend page. Role changes and
// invites are still authorized server-side regardless of what this page
// shows (requirePermission("users:manage")/("org:manage")) — isAdmin
// here only decides what CONTROLS render, never what's allowed.
export function OrganizationPage() {
  const { user, organization } = useAuth();
  // Matches ROLE_PERMISSIONS on the backend: only ADMIN has
  // "org:manage"/"users:manage" — this just decides what CONTROLS
  // render, the backend re-checks the real permission on every request.
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(ROLES.VIEWER);
  const [retentionDays, setRetentionDays] = useState("");

  const { data: org } = useQuery({ queryKey: ["organization"], queryFn: getOrganization });
  const { data: members = [], isLoading } = useQuery({ queryKey: ["org-members"], queryFn: listMembers });

  const inviteMutation = useMutation({
    mutationFn: inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      setInviteEmail("");
    }
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }) => changeMemberRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-members"] })
  });

  const privacyMutation = useMutation({
    mutationFn: (days) => updatePrivacySettings(days === "" ? null : Number(days)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization"] })
  });

  function handleInvite(e) {
    e.preventDefault();
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  }

  function handlePrivacySubmit(e) {
    e.preventDefault();
    privacyMutation.mutate(retentionDays);
  }

  return (
    <div>
      <h1>Organization</h1>
      <Card title={org?.name ?? organization?.name ?? "Organization"}>
        <p>Organization ID: {org?.id ?? organization?.id}</p>
      </Card>

      <Card title="Members">
        {isLoading ? <p>Loading members...</p> : <Table columns={memberColumns(isAdmin, (userId, role) => roleMutation.mutate({ userId, role }))} rows={members} rowKey="id" />}

        {isAdmin && (
          <form onSubmit={handleInvite} className="invite-form">
            <Input
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {Object.values(ROLES).map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Inviting..." : "Invite"}
            </Button>
            {inviteMutation.isError && (
              <p className="form-error">{inviteMutation.error?.response?.data?.error?.message ?? "Could not invite that user."}</p>
            )}
          </form>
        )}
      </Card>

      {isAdmin && (
        <Card title="Privacy settings">
          <form onSubmit={handlePrivacySubmit}>
            <label>
              Audit &amp; decision retention (days) — leave blank to retain indefinitely
            </label>
            <Input
              type="number"
              min="1"
              max="3650"
              placeholder={org?.auditRetentionDays ? String(org.auditRetentionDays) : "Indefinite"}
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
            />
            <Button type="submit" disabled={privacyMutation.isPending}>
              {privacyMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
