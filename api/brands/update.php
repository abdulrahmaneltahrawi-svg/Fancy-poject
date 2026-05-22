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

$brandId = (int)($input['brand_id'] ?? 0);

$brandName = cleanInput($input['brand_name'] ?? '');
$brandType = cleanInput($input['brand_type'] ?? '');
$email = strtolower(cleanInput($input['email'] ?? ''));
$phoneCode = cleanInput($input['phone_code'] ?? '');
$phone = cleanInput($input['phone'] ?? '');
$country = cleanInput($input['country'] ?? '');
$city = cleanInput($input['city'] ?? '');
$website = cleanInput($input['website'] ?? '');
$description = cleanInput($input['description'] ?? '');

if ($brandId <= 0) {
    jsonResponse(false, "Brand ID is required", [
        "code" => "BRAND_ID_REQUIRED"
    ], 422);
}

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
        SELECT id, user_id, status
        FROM brands
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$brandId, $auth['user_id']]);
    $brand = $stmt->fetch();

    if (!$brand) {
        jsonResponse(false, "Brand not found or you do not have permission", [
            "code" => "BRAND_NOT_FOUND"
        ], 404);
    }

    if ($brand['status'] === 'suspended') {
        jsonResponse(false, "Suspended brand cannot be updated", [
            "code" => "BRAND_SUSPENDED"
        ], 403);
    }

    $stmt = $pdo->prepare("
        UPDATE brands
        SET
            brand_name = :brand_name,
            brand_type = :brand_type,
            email = :email,
            phone_code = :phone_code,
            phone = :phone,
            country = :country,
            city = :city,
            website = :website,
            description = :description
        WHERE id = :id
          AND user_id = :user_id
    ");

    $stmt->execute([
        ":brand_name" => $brandName,
        ":brand_type" => $brandType ?: null,
        ":email" => $email ?: null,
        ":phone_code" => $phoneCode ?: null,
        ":phone" => $phone ?: null,
        ":country" => $country ?: null,
        ":city" => $city ?: null,
        ":website" => $website ?: null,
        ":description" => $description ?: null,
        ":id" => $brandId,
        ":user_id" => $auth['user_id']
    ]);

    jsonResponse(true, "Brand updated successfully", [
        "brand_id" => $brandId
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}