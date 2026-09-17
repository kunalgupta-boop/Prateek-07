package com.secureauth.app;

import java.time.LocalDateTime;

public record User(
        Long id,
        String fullName,
        String email,
        String passwordHash,
        LocalDateTime createdAt
) {}
