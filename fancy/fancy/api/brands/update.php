<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

$auth = requireAuth();

/*
|--------------------------------------------------------------------------
| Image URL Helper
|--------------------------------------------------------------------------
*/
function imageUrl($path)
{
    if (!$path) {
        return null;
    }

    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}

/*
|--------------------------------------------------------------------------
| Delete old uploaded image
|--------------------------------------------------------------------------
*/
function deleteOldBrandImage($path)
{
    if (!$path) {
        return;
    }

    $fullPath = __DIR__ . "/../../" . ltrim($path, '/');

    if (file_exists($fullPath) && is_file($fullPath)) {
        unlink($fullPath);
    }
}

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
$brandId = (int)($_POST['brand_id'] ?? 0);

$brandName = cleanInput($_POST['brand_name'] ?? '');
$brandType = cleanInput($_POST['brand_type'] ?? '');
$email = strtolower(cleanInput($_POST['email'] ?? ''));
$phoneCode = cleanInput($_POST['phone_code'] ?? '');
$phone = cleanInput($_POST['phone'] ?? '');
$country = cleanInput($_POST['country'] ?? '');
$city = cleanInput($_POST['city'] ?? '');
$website = cleanInput($_POST['website'] ?? '');
$description = cleanInput($_POST['description'] ?? '');

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
        SELECT 
            id, 
            user_id, 
            status,
            logo,
            cover_image
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

    /*
    |--------------------------------------------------------------------------
    | Upload new images if sent
    |--------------------------------------------------------------------------
    */
    $newLogoPath = uploadBrandImage('logo');
    $newCoverImagePath = uploadBrandImage('cover_image');

    $finalLogoPath = $newLogoPath ?: $brand['logo'];
    $finalCoverImagePath = $newCoverImagePath ?: $brand['cover_image'];

    /*
    |--------------------------------------------------------------------------
    | Delete old images only if new images uploaded
    |--------------------------------------------------------------------------
    */
    if ($newLogoPath && $brand['logo']) {
        deleteOldBrandImage($brand['logo']);
    }

    if ($newCoverImagePath && $brand['cover_image']) {
        deleteOldBrandImage($brand['cover_image']);
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
            description = :description,
            logo = :logo,
            cover_image = :cover_image
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
        ":logo" => $finalLogoPath,
        ":cover_image" => $finalCoverImagePath,
        ":id" => $brandId,
        ":user_id" => $auth['user_id']
    ]);

    jsonResponse(true, "Brand updated successfully", [
        "brand_id" => $brandId,
        "logo" => $finalLogoPath,
        "logo_url" => imageUrl($finalLogoPath),
        "cover_image" => $finalCoverImagePath,
        "cover_image_url" => imageUrl($finalCoverImagePath)
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}