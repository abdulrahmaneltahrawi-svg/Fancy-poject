<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php";

$auth = requireAuth();

try {
    $stmt = $pdo->prepare("
        SELECT 
            id,
            account_type,
            first_name,
            last_name,
            email,
            phone,
            role,
            status,
            email_verified,
            email_verified_at,
            last_login_at,
            created_at
        FROM users
        WHERE id = ?
        LIMIT 1
    ");

    $stmt->execute([$auth['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(false, "User not found", [
            "code" => "USER_NOT_FOUND"
        ], 404);
    }

    jsonResponse(true, "User data retrieved successfully", [
        "user" => [
            "id" => (int)$user['id'],
            "account_type" => $user['account_type'],
            "first_name" => $user['first_name'],
            "last_name" => $user['last_name'],
            "email" => $user['email'],
            "phone" => $user['phone'],
            "role" => $user['role'],
            "status" => $user['status'],
            "email_verified" => (int)$user['email_verified'],
            "email_verified_at" => $user['email_verified_at'],
            "last_login_at" => $user['last_login_at'],
            "created_at" => $user['created_at']
        ]
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}