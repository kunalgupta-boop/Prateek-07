package com.secureauth.app;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class AuthService {

    private static final Pattern EMAIL =
            Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private static final Pattern UPPER = Pattern.compile("[A-Z]");
    private static final Pattern NUMBER = Pattern.compile("\\d");
    private static final Pattern SYMBOL = Pattern.compile("[^A-Za-z0-9]");

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    public Optional<String> validateSignup(String fullName, String email, String password) {
        if (fullName == null || fullName.trim().isEmpty()) {
            return Optional.of("Full name is required.");
        }

        if (fullName.trim().length() > 100) {
            return Optional.of("Full name is too long.");
        }

        String normalizedEmail = normalizeEmail(email);

        if (normalizedEmail.isEmpty() || !EMAIL.matcher(normalizedEmail).matches()) {
            return Optional.of("Enter a valid email address.");
        }

        if (normalizedEmail.length() > 190) {
            return Optional.of("Email address is too long.");
        }

        if (password == null
                || password.length() < 8
                || !UPPER.matcher(password).find()
                || !NUMBER.matcher(password).find()
                || !SYMBOL.matcher(password).find()) {
            return Optional.of(
                    "Password must contain 8+ characters, one uppercase letter, one number and one special character."
            );
        }

        return Optional.empty();
    }

    public boolean signup(String fullName, String email, String password) {
        String normalizedEmail = normalizeEmail(email);

        if (userRepository.existsByEmail(normalizedEmail)) {
            return false;
        }

        try {
            userRepository.create(
                    fullName.trim(),
                    normalizedEmail,
                    passwordEncoder.encode(password)
            );
            return true;
        } catch (DuplicateKeyException ex) {
            return false;
        }
    }

    public Optional<User> authenticate(String email, String password) {
        String normalizedEmail = normalizeEmail(email);

        if (normalizedEmail.isEmpty() || password == null || password.isEmpty()) {
            return Optional.empty();
        }

        return userRepository.findByEmail(normalizedEmail)
                .filter(user -> passwordEncoder.matches(password, user.passwordHash()));
    }
}
