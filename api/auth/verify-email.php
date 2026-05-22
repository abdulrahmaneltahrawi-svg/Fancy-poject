<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

$input = getJsonInput();

$email = strtolower(cleanInput($input['email'] ?? ''));
$tokenCode = cleanInput($input['token_code'] ?? '');

if ($email === '' || $tokenCode === '') {
    jsonResponse(false, "Email and token code are required", [
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

    if (!$user) {
        jsonResponse(false, "User not found", [
            "code" => "USER_NOT_FOUND"
        ], 404);
    }

    if ((int)$user['email_verified'] === 1) {
        jsonResponse(false, "Email already verified", [
            "code" => "EMAIL_ALREADY_VERIFIED"
        ], 409);
    }

    if ((int)$user['email_verification_attempts'] >= 5) {
        jsonResponse(false, "Too many wrong attempts. Please request a new code.", [
            "code" => "TOO_MANY_ATTEMPTS"
        ], 429);
    }

    if (
        empty($user['email_verification_code']) ||
        empty($user['email_verification_expires_at'])
    ) {
        jsonResponse(false, "No active verification code. Please request a new code.", [
            "code" => "NO_ACTIVE_CODE"
        ], 400);
    }

    if (strtotime($user['email_verification_expires_at']) < time()) {
        jsonResponse(false, "Verification code expired. Please request a new code.", [
            "code" => "CODE_EXPIRED"
        ], 400);
    }

    if ($user['email_verification_code'] !== $tokenCode) {
        $stmt = $pdo->prepare("
            UPDATE users
            SET email_verification_attempts = email_verification_attempts + 1
            WHERE id = ?
        ");
        $stmt->execute([$user['id']]);

        $remainingAttempts = 5 - ((int)$user['email_verification_attempts'] + 1);

        jsonResponse(false, "Invalid verification code", [
            "code" => "INVALID_CODE",
            "remaining_attempts" => max(0, $remainingAttempts)
        ], 400);
    }

    if ($user['account_type'] === 'personal') {
        $newStatus = 'active';
        $nextStep = 'login';
    } elseif ($user['account_type'] === 'designer') {
        $newStatus = 'pending_profile';
        $nextStep = 'create_designer_profile';
    } elseif ($user['account_type'] === 'brand') {
        $newStatus = 'pending_profile';
        $nextStep = 'create_brand_profile';
    } else {
        jsonResponse(false, "Invalid account type", [
            "code" => "INVALID_ACCOUNT_TYPE"
        ], 422);
    }

    $stmt = $pdo->prepare("
        UPDATE users
        SET
            email_verified = 1,
            email_verified_at = NOW(),
            status = :status,
            email_verification_code = NULL,
            email_verification_expires_at = NULL,
            email_verification_attempts = 0
        WHERE id = :id
    ");

    $stmt->execute([
        ":status" => $newStatus,
        ":id" => $user['id']
    ]);

    jsonResponse(true, "Email verified successfully", [
        "user_id" => (int)$user['id'],
        "email" => $user['email'],
        "account_type" => $user['account_type'],
        "status" => $newStatus,
        "next_step" => $nextStep
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}