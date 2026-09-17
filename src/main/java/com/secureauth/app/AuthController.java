package com.secureauth.app;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final LoginAttemptService loginAttemptService;

    public AuthController(AuthService authService, LoginAttemptService loginAttemptService) {
        this.authService = authService;
        this.loginAttemptService = loginAttemptService;
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody SignupRequest body) {
        Optional<String> validation =
                authService.validateSignup(body.fullName(), body.email(), body.password());

        if (validation.isPresent()) {
            return ResponseEntity.badRequest()
                    .body(message(false, validation.get()));
        }

        if (!body.password().equals(body.confirmPassword())) {
            return ResponseEntity.badRequest()
                    .body(message(false, "Passwords do not match."));
        }

        boolean created = authService.signup(body.fullName(), body.email(), body.password());

        if (!created) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(message(false, "An account with this email already exists."));
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(message(true, "Account created successfully."));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody LoginRequest body,
            HttpServletRequest request
    ) {
        String email = authService.normalizeEmail(body.email());
        String remote = clientIp(request);
        String key = remote + "|" + email;

        if (loginAttemptService.isBlocked(key)) {
            Map<String, Object> response = message(false, "Too many sign-in attempts.");
            response.put("retryAfterSeconds", loginAttemptService.retryAfterSeconds(key));
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
        }

        Optional<User> user = authService.authenticate(email, body.password());

        if (user.isEmpty()) {
            loginAttemptService.recordFailure(key);

            if (loginAttemptService.isBlocked(key)) {
                Map<String, Object> response = message(false, "Too many sign-in attempts.");
                response.put("retryAfterSeconds", loginAttemptService.retryAfterSeconds(key));
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(message(false, "Invalid email or password."));
        }

        loginAttemptService.reset(key);

        HttpSession existing = request.getSession(false);
        if (existing != null) {
            existing.invalidate();
        }

        HttpSession session = request.getSession(true);
        session.setAttribute("userId", user.get().id());
        session.setAttribute("userName", user.get().fullName());
        session.setAttribute("userEmail", user.get().email());
        session.setMaxInactiveInterval(30 * 60);

        return ResponseEntity.ok(message(true, "Logged in successfully."));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(HttpServletRequest request) {
        HttpSession session = request.getSession(false);

        if (session == null || session.getAttribute("userId") == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(message(false, "Not authenticated."));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("authenticated", true);
        response.put("id", session.getAttribute("userId"));
        response.put("fullName", session.getAttribute("userName"));
        response.put("email", session.getAttribute("userEmail"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok(message(true, "Logged out."));
    }

    private Map<String, Object> message(boolean success, String text) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", success);
        response.put("message", text);
        return response;
    }

    private String clientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    public record SignupRequest(
            String fullName,
            String email,
            String password,
            String confirmPassword
    ) {}

    public record LoginRequest(String email, String password) {}
}
