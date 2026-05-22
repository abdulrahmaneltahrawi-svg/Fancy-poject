<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../services/EmailService.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

$input = getJsonInput();

$email = strtolower(cleanInput($input['email'] ?? ''));

if ($email === '') {
    jsonResponse(false, "Email is required", [
        "code" => "EMAIL_REQUIRED"
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

    if ($user['status'] !== 'pending_email_verification') {
        jsonResponse(false, "Account is not waiting for email verification", [
            "code" => "INVALID_ACCOUNT_STATUS",
            "status" => $user['status']
        ], 400);
    }

    $newCode = generateVerificationCode();

    $stmt = $pdo->prepare("
        UPDATE users
        SET
            email_verification_code = :code,
            email_verification_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
            email_verification_attempts = 0
        WHERE id = :id
    ");

    $stmt->execute([
        ":code" => $newCode,
        ":id" => $user['id']
    ]);

    $emailSent = sendVerificationEmail($user['email'], $user['first_name'], $newCode);

    if (!$emailSent) {
        jsonResponse(false, "Verification code could not be sent", [
            "code" => "EMAIL_SEND_FAILED"
        ], 500);
    }

    jsonResponse(true, "New verification code sent to email", [
        "email" => $user['email'],
        "next_step" => "verify_email"
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}