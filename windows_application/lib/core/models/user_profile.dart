class UserProfile {
  const UserProfile({
    required this.id,
    required this.username,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.fullName,
    required this.role,
    required this.isActive,
  });

  final int id;
  final String username;
  final String email;
  final String firstName;
  final String lastName;
  final String fullName;
  final String role;
  final bool isActive;

  bool get isAdmin => role == 'admin';
  bool get isStaff => role == 'admin' || role == 'staff';

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: (json['id'] as num).toInt(),
      username: json['username']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      firstName: json['first_name']?.toString() ?? '',
      lastName: json['last_name']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? '',
      role: json['role']?.toString() ?? 'viewer',
      isActive: json['is_active'] as bool? ?? false,
    );
  }
}
