package com.secureauth.app;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginAttemptService {

    private static final int MAX_FAILURES = 5;
    private static final long WINDOW_SECONDS = 15 * 60L;

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public boolean isBlocked(String key) {
        Attempt attempt = attempts.get(key);
        if (attempt == null) {
            return false;
        }

        long now = Instant.now().getEpochSecond();
        if (now >= attempt.blockedUntilEpochSecond()) {
            attempts.remove(key);
            return false;
        }

        return attempt.failures() >= MAX_FAILURES;
    }

    public long retryAfterSeconds(String key) {
        Attempt attempt = attempts.get(key);
        if (attempt == null) {
            return 0;
        }
        return Math.max(0, attempt.blockedUntilEpochSecond() - Instant.now().getEpochSecond());
    }

    public void recordFailure(String key) {
        long now = Instant.now().getEpochSecond();

        attempts.compute(key, (ignored, current) -> {
            if (current == null || now >= current.blockedUntilEpochSecond()) {
                return new Attempt(1, now + WINDOW_SECONDS);
            }

            return new Attempt(
                    Math.min(MAX_FAILURES, current.failures() + 1),
                    current.blockedUntilEpochSecond()
            );
        });
    }

    public void reset(String key) {
        attempts.remove(key);
    }

    private record Attempt(int failures, long blockedUntilEpochSecond) {}
}
