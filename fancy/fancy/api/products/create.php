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
// jsonResponse(true, "FILES DEBUG", [
//     "post" => $_POST,
//     "files" => $_FILES
// ]);

/*
|--------------------------------------------------------------------------
| Upload Product Image Helper
|--------------------------------------------------------------------------
*/
function uploadProductImage($fileInputName)
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

    $maxSize = 3 * 1024 * 1024; // 3MB

    if ($file['size'] > $maxSize) {
        jsonResponse(false, "Image size must not exceed 3MB", [
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

    $uploadDir = __DIR__ . "/../../uploads/products/";

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

    return "uploads/products/" . $fileName;
}

/*
|--------------------------------------------------------------------------
| Get form-data input
|--------------------------------------------------------------------------
*/
$brandId = (int)($_POST['brand_id'] ?? 0);

$categoryId = isset($_POST['category_id']) && $_POST['category_id'] !== ''
    ? (int)$_POST['category_id']
    : null;

$subCategoryId = isset($_POST['sub_category_id']) && $_POST['sub_category_id'] !== ''
    ? (int)$_POST['sub_category_id']
    : null;

$requestedCategoryName = cleanInput($_POST['requested_category_name'] ?? '');
$requestedSubCategoryName = cleanInput($_POST['requested_sub_category_name'] ?? '');

$productName = cleanInput($_POST['product_name'] ?? '');
$shortDescription = cleanInput($_POST['short_description'] ?? '');
$description = cleanInput($_POST['description'] ?? '');

if ($brandId <= 0) {
    jsonResponse(false, "Brand ID is required", [
        "code" => "BRAND_ID_REQUIRED"
    ], 422);
}

if ($productName === '') {
    jsonResponse(false, "Product name is required", [
        "code" => "PRODUCT_NAME_REQUIRED"
    ], 422);
}

if ($categoryId === null && $requestedCategoryName === '') {
    jsonResponse(false, "Please select a category or enter requested category name", [
        "code" => "CATEGORY_REQUIRED"
    ], 422);
}

if ($categoryId !== null && $subCategoryId === null && $requestedSubCategoryName === '') {
    jsonResponse(false, "Please select a sub category or enter requested sub category name", [
        "code" => "SUB_CATEGORY_REQUIRED"
    ], 422);
}

try {
    /*
    |--------------------------------------------------------------------------
    | 1. Check brand ownership and active status
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        SELECT id, status
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

    if ($brand['status'] !== 'active') {
        jsonResponse(false, "Brand must be active before adding products", [
            "code" => "BRAND_NOT_ACTIVE",
            "status" => $brand['status']
        ], 403);
    }

    /*
    |--------------------------------------------------------------------------
    | 2. Check category if selected
    |--------------------------------------------------------------------------
    */
    if ($categoryId !== null) {
        $stmt = $pdo->prepare("
            SELECT id
            FROM categories
            WHERE id = ?
              AND status = 'active'
            LIMIT 1
        ");
        $stmt->execute([$categoryId]);
        $category = $stmt->fetch();

        if (!$category) {
            jsonResponse(false, "Category not found", [
                "code" => "CATEGORY_NOT_FOUND"
            ], 404);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | 3. Check sub category if selected
    |--------------------------------------------------------------------------
    */
    if ($categoryId !== null && $subCategoryId !== null) {
        $stmt = $pdo->prepare("
            SELECT id
            FROM sub_categories
            WHERE id = ?
              AND category_id = ?
              AND status = 'active'
            LIMIT 1
        ");
        $stmt->execute([$subCategoryId, $categoryId]);
        $subCategory = $stmt->fetch();

        if (!$subCategory) {
            jsonResponse(false, "Sub category not found or does not belong to this category", [
                "code" => "INVALID_SUB_CATEGORY"
            ], 404);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | 4. Upload main image
    |--------------------------------------------------------------------------
    */
    $mainImagePath = uploadProductImage('main_image');

    /*
    |--------------------------------------------------------------------------
    | 5. Generate unique slug
    |--------------------------------------------------------------------------
    */
    $baseSlug = createSlug($productName);
    $slug = $baseSlug;
    $counter = 1;

    while (true) {
        $stmt = $pdo->prepare("SELECT id FROM products WHERE slug = ? LIMIT 1");
        $stmt->execute([$slug]);

        if (!$stmt->fetch()) {
            break;
        }

        $slug = $baseSlug . "-" . $counter;
        $counter++;
    }

    /*
    |--------------------------------------------------------------------------
    | 6. Insert product
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        INSERT INTO products (
            user_id,
            brand_id,
            category_id,
            sub_category_id,
            requested_category_name,
            requested_sub_category_name,
            product_name,
            slug,
            short_description,
            description,
            main_image,
            status
        ) VALUES (
            :user_id,
            :brand_id,
            :category_id,
            :sub_category_id,
            :requested_category_name,
            :requested_sub_category_name,
            :product_name,
            :slug,
            :short_description,
            :description,
            :main_image,
            'pending_admin_approval'
        )
    ");

    $stmt->execute([
        ":user_id" => $auth['user_id'],
        ":brand_id" => $brandId,
        ":category_id" => $categoryId,
        ":sub_category_id" => $subCategoryId,
        ":requested_category_name" => $requestedCategoryName ?: null,
        ":requested_sub_category_name" => $requestedSubCategoryName ?: null,
        ":product_name" => $productName,
        ":slug" => $slug,
        ":short_description" => $shortDescription ?: null,
        ":description" => $description ?: null,
        ":main_image" => $mainImagePath
    ]);

    $productId = $pdo->lastInsertId();

    jsonResponse(true, "Product created successfully. Waiting for admin approval.", [
        "product_id" => (int)$productId,
        "slug" => $slug,
        "main_image" => $mainImagePath,
        "status" => "pending_admin_approval",
        "next_step" => "waiting_admin_approval"
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}