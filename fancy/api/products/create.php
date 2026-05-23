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

$categoryId = isset($input['category_id']) && $input['category_id'] !== ''
    ? (int)$input['category_id']
    : null;

$subCategoryId = isset($input['sub_category_id']) && $input['sub_category_id'] !== ''
    ? (int)$input['sub_category_id']
    : null;

$requestedCategoryName = cleanInput($input['requested_category_name'] ?? '');
$requestedSubCategoryName = cleanInput($input['requested_sub_category_name'] ?? '');

$productName = cleanInput($input['product_name'] ?? '');
$shortDescription = cleanInput($input['short_description'] ?? '');
$description = cleanInput($input['description'] ?? '');

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

/*
|--------------------------------------------------------------------------
| Category validation
|--------------------------------------------------------------------------
| لازم المستخدم يعمل واحدة من الاتنين:
| 1. يختار category موجودة
| 2. يكتب requested_category_name لو الكاتيجوري مش موجودة
*/
if ($categoryId === null && $requestedCategoryName === '') {
    jsonResponse(false, "Please select a category or enter requested category name", [
        "code" => "CATEGORY_REQUIRED"
    ], 422);
}

/*
|--------------------------------------------------------------------------
| Sub Category validation
|--------------------------------------------------------------------------
| لو اختار category موجودة، لازم يختار sub_category أو يكتب requested_sub_category_name
*/
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
    | 4. Generate unique slug
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
    | 5. Insert product
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
        ":description" => $description ?: null
    ]);

    $productId = $pdo->lastInsertId();

    jsonResponse(true, "Product created successfully. Waiting for admin approval.", [
        "product_id" => (int)$productId,
        "slug" => $slug,
        "status" => "pending_admin_approval",
        "next_step" => "waiting_admin_approval"
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}