<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

$auth = requireAuth();

$input = getJsonInput();

$brandName = cleanInput($input['brand_name'] ?? '');
$brandType = cleanInput($input['brand_type'] ?? '');
$email = strtolower(cleanInput($input['email'] ?? ''));
$phoneCode = cleanInput($input['phone_code'] ?? '');
$phone = cleanInput($input['phone'] ?? '');
$country = cleanInput($input['country'] ?? '');
$city = cleanInput($input['city'] ?? '');
$website = cleanInput($input['website'] ?? '');
$description = cleanInput($input['description'] ?? '');

if ($brandName === '') {
    jsonResponse(false, "Brand name is required", [
        "code" => "BRAND_NAME_REQUIRED"
    ], 422);
}

if ($email !== '' && !isValidEmail($email)) {
    jsonResponse(false, "Invalid brand email address", [
        "code" => "INVALID_BRAND_EMAIL"
    ], 422);
}

try {
    $stmt = $pdo->prepare("
        SELECT id, status, email_verified
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

    if ((int)$user['email_verified'] !== 1) {
        jsonResponse(false, "Please verify your email first", [
            "code" => "EMAIL_NOT_VERIFIED"
        ], 403);
    }

    if ($user['status'] !== 'active') {
        jsonResponse(false, "Your account must be active to create a brand", [
            "code" => "ACCOUNT_NOT_ACTIVE",
            "status" => $user['status']
        ], 403);
    }

    $stmt = $pdo->prepare("
        INSERT INTO brands (
            user_id,
            brand_name,
            brand_type,
            email,
            phone_code,
            phone,
            country,
            city,
            website,
            description,
            status
        ) VALUES (
            :user_id,
            :brand_name,
            :brand_type,
            :email,
            :phone_code,
            :phone,
            :country,
            :city,
            :website,
            :description,
            'pending_admin_approval'
        )
    ");

    $stmt->execute([
        ":user_id" => $auth['user_id'],
        ":brand_name" => $brandName,
        ":brand_type" => $brandType ?: null,
        ":email" => $email ?: null,
        ":phone_code" => $phoneCode ?: null,
        ":phone" => $phone ?: null,
        ":country" => $country ?: null,
        ":city" => $city ?: null,
        ":website" => $website ?: null,
        ":description" => $description ?: null
    ]);

    $brandId = $pdo->lastInsertId();

    jsonResponse(true, "Brand created successfully. Waiting for admin approval.", [
        "brand_id" => (int)$brandId,
        "status" => "pending_admin_approval",
        "next_step" => "waiting_admin_approval"
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}