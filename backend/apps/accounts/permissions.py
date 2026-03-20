# G:/msms/backend/apps/accounts/permissions.py
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Only admin users can perform this action."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsAdminOrStaff(BasePermission):
    """Admins and staff can perform this action."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('admin', 'staff')
        )
