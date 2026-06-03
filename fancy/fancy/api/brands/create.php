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

/*
|--------------------------------------------------------------------------
| Upload helper
|--------------------------------------------------------------------------
*/
function uploadBrandImage($fileInputName)
{
    if (!isset($_FILES[$fileInputName]) || $_FILES[$fileInputName]['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$fileInputName];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(false, "File upload error", [
            "code" => "FILE_UPLOAD_ERROR",
            "field" => $fileInputName
        ], 400);
    }

    $maxSize = 2 * 1024 * 1024; // 2MB

    if ($file['size'] > $maxSize) {
        jsonResponse(false, "Image size must not exceed 2MB", [
            "code" => "IMAGE_TOO_LARGE",
            "field" => $fileInputName
        ], 422);
    }

    $allowedMimeTypes = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp'
    ];

    $mimeType = mime_content_type($file['tmp_name']);

    if (!array_key_exists($mimeType, $allowedMimeTypes)) {
        jsonResponse(false, "Only JPG, PNG and WEBP images are allowed", [
            "code" => "INVALID_IMAGE_TYPE",
            "field" => $fileInputName
        ], 422);
    }

    $extension = $allowedMimeTypes[$mimeType];

    $uploadDir = __DIR__ . "/../../uploads/brands/";

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0775, true);
    }

    $fileName = $fileInputName . "_" . time() . "_" . bin2hex(random_bytes(8)) . "." . $extension;

    $destination = $uploadDir . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        jsonResponse(false, "Could not save uploaded image", [
            "code" => "IMAGE_SAVE_FAILED",
            "field" => $fileInputName
        ], 500);
    }

    return "uploads/brands/" . $fileName;
}

/*
|--------------------------------------------------------------------------
| Get form-data input
|--------------------------------------------------------------------------
*/
$brandName = cleanInput($_POST['brand_name'] ?? '');
$brandType = cleanInput($_POST['brand_type'] ?? '');
$email = strtolower(cleanInput($_POST['email'] ?? ''));
$phoneCode = cleanInput($_POST['phone_code'] ?? '');
$phone = cleanInput($_POST['phone'] ?? '');
$country = cleanInput($_POST['country'] ?? '');
$city = cleanInput($_POST['city'] ?? '');
$website = cleanInput($_POST['website'] ?? '');
$description = cleanInput($_POST['description'] ?? '');

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

    /*
    |--------------------------------------------------------------------------
    | Upload images
    |--------------------------------------------------------------------------
    */
    $logoPath = uploadBrandImage('logo');
    $coverImagePath = uploadBrandImage('cover_image');

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
            logo,
            cover_image,
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
            :logo,
            :cover_image,
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
        ":description" => $description ?: null,
        ":logo" => $logoPath,
        ":cover_image" => $coverImagePath
    ]);

    $brandId = $pdo->lastInsertId();

    jsonResponse(true, "Brand created successfully. Waiting for admin approval.", [
        "brand_id" => (int)$brandId,
        "logo" => $logoPath,
        "cover_image" => $coverImagePath,
        "status" => "pending_admin_approval",
        "next_step" => "waiting_admin_approval"
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}