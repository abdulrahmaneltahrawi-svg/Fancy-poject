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

$productId = (int)($input['product_id'] ?? 0);
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

if ($productId <= 0) {
    jsonResponse(false, "Product ID is required", [
        "code" => "PRODUCT_ID_REQUIRED"
    ], 422);
}

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
    | 1. Check product ownership
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        SELECT id, user_id, status
        FROM products
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$productId, $auth['user_id']]);
    $product = $stmt->fetch();

    if (!$product) {
        jsonResponse(false, "Product not found or you do not have permission", [
            "code" => "PRODUCT_NOT_FOUND"
        ], 404);
    }

    if ($product['status'] === 'suspended') {
        jsonResponse(false, "Suspended product cannot be updated", [
            "code" => "PRODUCT_SUSPENDED"
        ], 403);
    }

    /*
    |--------------------------------------------------------------------------
    | 2. Check brand ownership and active status
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
        jsonResponse(false, "Brand must be active before assigning products to it", [
            "code" => "BRAND_NOT_ACTIVE",
            "status" => $brand['status']
        ], 403);
    }

    /*
    |--------------------------------------------------------------------------
    | 3. Check category if selected
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
    | 4. Check sub category if selected
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
    | 5. Generate unique slug if product name changed
    |--------------------------------------------------------------------------
    */
    $baseSlug = createSlug($productName);
    $slug = $baseSlug;
    $counter = 1;

    while (true) {
        $stmt = $pdo->prepare("
            SELECT id
            FROM products
            WHERE slug = ?
              AND id != ?
            LIMIT 1
        ");
        $stmt->execute([$slug, $productId]);

        if (!$stmt->fetch()) {
            break;
        }

        $slug = $baseSlug . "-" . $counter;
        $counter++;
    }

    /*
    |--------------------------------------------------------------------------
    | 6. Update product
    |--------------------------------------------------------------------------
    | لو المنتج كان active وعدّله المستخدم، هنرجعه pending_admin_approval
    | عشان الأدمن يراجع التعديل.
    */
    $newStatus = $product['status'] === 'active'
        ? 'pending_admin_approval'
        : $product['status'];

    $stmt = $pdo->prepare("
        UPDATE products
        SET
            brand_id = :brand_id,
            category_id = :category_id,
            sub_category_id = :sub_category_id,
            requested_category_name = :requested_category_name,
            requested_sub_category_name = :requested_sub_category_name,
            product_name = :product_name,
            slug = :slug,
            short_description = :short_description,
            description = :description,
            status = :status
        WHERE id = :id
          AND user_id = :user_id
    ");

    $stmt->execute([
        ":brand_id" => $brandId,
        ":category_id" => $categoryId,
        ":sub_category_id" => $subCategoryId,
        ":requested_category_name" => $requestedCategoryName ?: null,
        ":requested_sub_category_name" => $requestedSubCategoryName ?: null,
        ":product_name" => $productName,
        ":slug" => $slug,
        ":short_description" => $shortDescription ?: null,
        ":description" => $description ?: null,
        ":status" => $newStatus,
        ":id" => $productId,
        ":user_id" => $auth['user_id']
    ]);

    jsonResponse(true, "Product updated successfully", [
        "product_id" => $productId,
        "slug" => $slug,
        "status" => $newStatus
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}