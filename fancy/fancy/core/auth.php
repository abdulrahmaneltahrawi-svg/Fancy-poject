<?php

require_once __DIR__ . "/helpers.php";
require_once __DIR__ . "/response.php";

function requireAuth()
{
    startSessionIfNotStarted();

    if (!isset($_SESSION['user_id'])) {
        jsonResponse(false, "Unauthorized", [
            "code" => "UNAUTHORIZED"
        ], 401);
    }

    return [
        "user_id" => $_SESSION['user_id'],
        "account_type" => $_SESSION['account_type'] ?? null,
        "role" => $_SESSION['role'] ?? 'user'
    ];
}

function requireAdmin()
{
    $auth = requireAuth();

    if (($auth['role'] ?? '') !== 'admin') {
        jsonResponse(false, "Forbidden. Admin only.", [
            "code" => "ADMIN_ONLY"
        ], 403);
    }

    return $auth;
}