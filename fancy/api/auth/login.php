<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";

startSessionIfNotStarted();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

$input = getJsonInput();

$email = strtolower(cleanInput($input['email'] ?? ''));
$password = $input['password'] ?? '';

if ($email === '' || $password === '') {
    jsonResponse(false, "Email and password are required", [
        "code" => "REQUIRED_FIELDS_MISSING"
    ], 422);
}

if (!isValidEmail($email)) {
    jsonResponse(false, "Invalid email address", [
        "code" => "INVALID_EMAIL"
    ], 422);
}

try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonResponse(false, "Invalid email or password", [
            "code" => "INVALID_CREDENTIALS"
        ], 401);
    }

    if ((int)$user['email_verified'] !== 1) {
        jsonResponse(false, "Please verify your email before login", [
            "code" => "EMAIL_NOT_VERIFIED",
            "next_step" => "verify_email"
        ], 403);
    }

    if ($user['status'] === 'rejected') {
        jsonResponse(false, "Your account has been rejected", [
            "code" => "ACCOUNT_REJECTED"
        ], 403);
    }

    if ($user['status'] === 'suspended') {
        jsonResponse(false, "Your account is suspended", [
            "code" => "ACCOUNT_SUSPENDED"
        ], 403);
    }

    session_regenerate_id(true);

    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['account_type'] = $user['account_type'];
    $_SESSION['role'] = $user['role'];

    $stmt = $pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
    $stmt->execute([$user['id']]);

    $nextStep = "dashboard";

    if ($user['status'] === 'pending_profile') {
        if ($user['account_type'] === 'designer') {
            $nextStep = "create_designer_profile";
        } elseif ($user['account_type'] === 'brand') {
            $nextStep = "create_brand_profile";
        }
    }

    if ($user['status'] === 'pending_admin_approval') {
        $nextStep = "waiting_admin_approval";
    }

    jsonResponse(true, "Login successful", [
        "user" => [
            "id" => (int)$user['id'],
            "account_type" => $user['account_type'],
            "first_name" => $user['first_name'],
            "last_name" => $user['last_name'],
            "email" => $user['email'],
            "phone" => $user['phone'],
            "role" => $user['role'],
            "status" => $user['status']
        ],
        "next_step" => $nextStep
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}