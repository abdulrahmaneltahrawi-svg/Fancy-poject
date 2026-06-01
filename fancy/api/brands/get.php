<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php";
require_once __DIR__ . "/../../config/app.php";

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

$auth = requireAuth();

$brandId = (int)($_GET['brand_id'] ?? 0);

if ($brandId <= 0) {
    jsonResponse(false, "Brand ID is required", [
        "code" => "BRAND_ID_REQUIRED"
    ], 422);
}

/*
|--------------------------------------------------------------------------
| Build base URL
|--------------------------------------------------------------------------
| Example:
| http://localhost/fancy/
|--------------------------------------------------------------------------
*/


function imageUrl($path)
{
    if (!$path) {
        return null;
    }

    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}
try {
    $stmt = $pdo->prepare("
        SELECT
            id,
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
            status,
            created_at,
            updated_at
        FROM brands
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
    ");

    $stmt->execute([$brandId, $auth['user_id']]);
    $brand = $stmt->fetch();

    if (!$brand) {
        jsonResponse(false, "Brand not found", [
            "code" => "BRAND_NOT_FOUND"
        ], 404);
    }

    $brand['id'] = (int)$brand['id'];
    $brand['user_id'] = (int)$brand['user_id'];

    $brand['logo_url'] = imageUrl($brand['logo']);
    $brand['cover_image_url'] = imageUrl($brand['cover_image']);

    jsonResponse(true, "Brand retrieved successfully", [
        "brand" => $brand
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}