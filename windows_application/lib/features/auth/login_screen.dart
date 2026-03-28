import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/branding/app_brand.dart';
import '../../core/utils/error_message.dart';
import 'session_controller.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await context.read<SessionController>().login(
        username: _usernameController.text.trim(),
        password: _passwordController.text,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            friendlyErrorMessage(
              error,
              fallback: 'Invalid credentials. Please try again.',
            ),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final inputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: Color(0xFFD8E1EB)),
    );

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFFCFDFF), Color(0xFFF4F7FB)],
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              top: 96,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  width: 220,
                  height: 220,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF99F6E4).withValues(alpha: 0.55),
                        blurRadius: 120,
                        spreadRadius: 6,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 72,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  width: 320,
                  height: 180,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFBFDBFE).withValues(alpha: 0.5),
                        blurRadius: 140,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 40,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 430),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 54),
                        padding: const EdgeInsets.fromLTRB(32, 84, 32, 28),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.92),
                          borderRadius: BorderRadius.circular(30),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.82),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(
                                0xFF0F172A,
                              ).withValues(alpha: 0.14),
                              blurRadius: 72,
                              offset: const Offset(0, 24),
                            ),
                          ],
                        ),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Sign in to continue',
                                textAlign: TextAlign.center,
                                style: theme.textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                AppBrand.supportText,
                                textAlign: TextAlign.center,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: const Color(0xFF64748B),
                                  height: 1.6,
                                ),
                              ),
                              const SizedBox(height: 32),
                              Text(
                                'Username',
                                style: theme.textTheme.labelLarge?.copyWith(
                                  color: const Color(0xFF334155),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextFormField(
                                controller: _usernameController,
                                decoration: InputDecoration(
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAFC),
                                  hintText: 'Enter your username',
                                  enabledBorder: inputBorder,
                                  focusedBorder: inputBorder.copyWith(
                                    borderSide: const BorderSide(
                                      color: Color(0xFF34D399),
                                      width: 1.4,
                                    ),
                                  ),
                                  errorBorder: inputBorder.copyWith(
                                    borderSide: BorderSide(
                                      color: theme.colorScheme.error,
                                    ),
                                  ),
                                  focusedErrorBorder: inputBorder.copyWith(
                                    borderSide: BorderSide(
                                      color: theme.colorScheme.error,
                                      width: 1.4,
                                    ),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 16,
                                  ),
                                ),
                                validator: (value) {
                                  if (value == null || value.trim().isEmpty) {
                                    return 'Username is required';
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 18),
                              Text(
                                'Password',
                                style: theme.textTheme.labelLarge?.copyWith(
                                  color: const Color(0xFF334155),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextFormField(
                                controller: _passwordController,
                                obscureText: _obscurePassword,
                                decoration: InputDecoration(
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAFC),
                                  hintText: 'Enter your password',
                                  enabledBorder: inputBorder,
                                  focusedBorder: inputBorder.copyWith(
                                    borderSide: const BorderSide(
                                      color: Color(0xFF34D399),
                                      width: 1.4,
                                    ),
                                  ),
                                  errorBorder: inputBorder.copyWith(
                                    borderSide: BorderSide(
                                      color: theme.colorScheme.error,
                                    ),
                                  ),
                                  focusedErrorBorder: inputBorder.copyWith(
                                    borderSide: BorderSide(
                                      color: theme.colorScheme.error,
                                      width: 1.4,
                                    ),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 16,
                                  ),
                                  suffixIcon: IconButton(
                                    onPressed: () => setState(
                                      () =>
                                          _obscurePassword = !_obscurePassword,
                                    ),
                                    icon: Icon(
                                      _obscurePassword
                                          ? Icons.visibility_off_outlined
                                          : Icons.visibility_outlined,
                                      color: const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ),
                                validator: (value) {
                                  if (value == null || value.isEmpty) {
                                    return 'Password is required';
                                  }
                                  return null;
                                },
                                onFieldSubmitted: (_) => _submit(),
                              ),
                              const SizedBox(height: 26),
                              SizedBox(
                                height: 52,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [
                                        Color(0xFF059669),
                                        Color(0xFF0F766E),
                                      ],
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(
                                          0xFF065F46,
                                        ).withValues(alpha: 0.18),
                                        blurRadius: 28,
                                        offset: const Offset(0, 10),
                                      ),
                                    ],
                                  ),
                                  child: FilledButton(
                                    onPressed: _isSubmitting ? null : _submit,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: Colors.transparent,
                                      disabledBackgroundColor:
                                          Colors.transparent,
                                      shadowColor: Colors.transparent,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                    ),
                                    child: _isSubmitting
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              valueColor:
                                                  AlwaysStoppedAnimation<Color>(
                                                    Colors.white,
                                                  ),
                                            ),
                                          )
                                        : Text(
                                            'Sign In',
                                            style: theme.textTheme.titleMedium
                                                ?.copyWith(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                          ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 22),
                              Text(
                                AppBrand.displayName,
                                textAlign: TextAlign.center,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: const Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        child: Center(child: _LoginLogo()),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoginLogo extends StatelessWidget {
  const _LoginLogo();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 108,
      height: 108,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F766E).withValues(alpha: 0.18),
            blurRadius: 36,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(30),
          gradient: const LinearGradient(
            colors: [Color(0xFF2563EB), Color(0xFF65A30D)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(color: Colors.white, width: 3),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            const Icon(Icons.medication_rounded, color: Colors.white, size: 44),
            Positioned(
              top: 8,
              child: Container(
                width: 24,
                height: 24,
                decoration: const BoxDecoration(
                  color: Color(0xFF16A34A),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
