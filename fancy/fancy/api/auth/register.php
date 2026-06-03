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

$accountType = cleanInput($input['account_type'] ?? '');
$firstName = cleanInput($input['first_name'] ?? '');
$lastName = cleanInput($input['last_name'] ?? '');
$email = strtolower(cleanInput($input['email'] ?? ''));
$phone = cleanInput($input['phone'] ?? '');
$password = $input['password'] ?? '';

$allowedTypes = ['personal', 'designer', 'brand'];

if (!in_array($accountType, $allowedTypes)) {
    jsonResponse(false, "Invalid account type", [
        "code" => "INVALID_ACCOUNT_TYPE"
    ], 422);
}

if ($firstName === '' || $lastName === '' || $email === '' || $password === '') {
    jsonResponse(false, "First name, last name, email and password are required", [
        "code" => "REQUIRED_FIELDS_MISSING"
    ], 422);
}

if (!isValidEmail($email)) {
    jsonResponse(false, "Invalid email address", [
        "code" => "INVALID_EMAIL"
    ], 422);
}

if (strlen($password) < 8) {
    jsonResponse(false, "Password must be at least 8 characters", [
        "code" => "WEAK_PASSWORD"
    ], 422);
}

try {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        jsonResponse(false, "Email already exists", [
            "code" => "EMAIL_EXISTS"
        ], 409);
    }

    $verificationCode = generateVerificationCode();
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("
        INSERT INTO users (
            account_type,
            first_name,
            last_name,
            email,
            password,
            phone,
            role,
            status,
            email_verified,
            email_verification_code,
            email_verification_expires_at,
            email_verification_attempts
        ) VALUES (
            :account_type,
            :first_name,
            :last_name,
            :email,
            :password,
            :phone,
            'user',
            'pending_email_verification',
            0,
            :verification_code,
            DATE_ADD(NOW(), INTERVAL 15 MINUTE),
            0
        )
    ");

    $stmt->execute([
        ":account_type" => $accountType,
        ":first_name" => $firstName,
        ":last_name" => $lastName,
        ":email" => $email,
        ":password" => $hashedPassword,
        ":phone" => $phone ?: null,
        ":verification_code" => $verificationCode
    ]);

    $userId = $pdo->lastInsertId();

    $emailSent = sendVerificationEmail($email, $firstName, $verificationCode);

    if (!$emailSent) {
        jsonResponse(false, "Account created but verification email could not be sent", [
            "code" => "EMAIL_SEND_FAILED",
            "user_id" => (int)$userId,
            "email" => $email
        ], 500);
    }

    jsonResponse(true, "Account created. Verification code sent to email.", [
        "user_id" => (int)$userId,
        "email" => $email,
        "account_type" => $accountType,
        "next_step" => "verify_email"
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR"
    ], 500);
}