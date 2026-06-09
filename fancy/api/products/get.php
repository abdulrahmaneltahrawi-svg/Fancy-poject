<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

$productId = (int)($_GET['product_id'] ?? 0);

if ($productId <= 0) {
    jsonResponse(false, "Product ID is required", [
        "code" => "PRODUCT_ID_REQUIRED"
    ], 422);
}

try {
    /*
    |--------------------------------------------------------------------------
    | 1. استعلام جلب بيانات المنتج الأساسية والبراند والأقسام
    |--------------------------------------------------------------------------
    | ملاحظة: تم إضافة products.technical_data لضمان جلب كل البيانات المخزنة
    */
    $stmt = $pdo->prepare("
        SELECT
            products.id,
            products.user_id,
            products.brand_id,
            products.category_id,
            products.sub_category_id,
            products.requested_category_name,
            products.requested_sub_category_name,
            products.product_name,
            products.slug,
            products.short_description,
            products.description,
            products.technical_data,
            products.main_image,
            products.status,
            products.created_at,
            products.updated_at,

            brands.brand_name,
            brands.status AS brand_status,

            categories.name AS category_name,
            categories.slug AS category_slug,

            sub_categories.name AS sub_category_name,
            sub_categories.slug AS sub_category_slug

        FROM products

        INNER JOIN brands
            ON brands.id = products.brand_id

        LEFT JOIN categories
            ON categories.id = products.category_id

        LEFT JOIN sub_categories
            ON sub_categories.id = products.sub_category_id

        WHERE products.id = ?
          AND products.status != 'deleted' 
        LIMIT 1
    ");

    $stmt->execute([$productId]);
    $product = $stmt->fetch();

    // إذا لم يتم العثور على المنتج أو كان محذوفاً (Soft Deleted)
    if (!$product) {
        jsonResponse(false, "Product not found", [
            "code" => "PRODUCT_NOT_FOUND"
        ], 404);
    }

    /*
    |--------------------------------------------------------------------------
    | 2. استعلام جلب الأوبشنز (Options) الخاصة بالمنتج الحالي
    |--------------------------------------------------------------------------
    */
    $stmtOptions = $pdo->prepare("
        SELECT 
            id,
            option_name,
            type_size,
            sku,
            cbm,
            image_path
        FROM product_options 
        WHERE product_id = ?
    ");
    $stmtOptions->execute([$productId]);
    $options = $stmtOptions->fetchAll();

    // تحويل أنواع البيانات الرقمية للـ Options لضمان نظافة الـ JSON للفرونت إند
    foreach ($options as $index => $option) {
        $options[$index]['id'] = (int)$option['id'];
    }

    /*
    |--------------------------------------------------------------------------
    | 3. تجهيز وعمل Cast للبيانات المرجوعة للفرونت إند
    |--------------------------------------------------------------------------
    */
    $product['id'] = (int)$product['id'];
    $product['user_id'] = (int)$product['user_id'];
    $product['brand_id'] = (int)$product['brand_id'];
    $product['category_id'] = $product['category_id'] !== null ? (int)$product['category_id'] : null;
    $product['sub_category_id'] = $product['sub_category_id'] !== null ? (int)$product['sub_category_id'] : null;

    // دمج مصفوفة الأوبشنز داخل أوبجكت المنتج الرئيسي
    $product['options'] = $options;

    // إرسال الرد النهائي بنجاح
    jsonResponse(true, "Product retrieved successfully", [
        "product" => $product
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}