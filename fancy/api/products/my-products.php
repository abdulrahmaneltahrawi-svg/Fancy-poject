<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php";

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// حماية الـ API وجلب بيانات المستخدم الحالي
$auth = requireAuth();

try {
    /*
    |--------------------------------------------------------------------------
    | 1. استعلام جلب المنتجات الأساسية الخاصة بالمستخدم الحالي فقط
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        SELECT
            products.id,
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

        WHERE products.user_id = ?
          AND products.status != 'deleted'

        ORDER BY products.id DESC
    ");

    $stmt->execute([$auth['user_id']]);
    $products = $stmt->fetchAll();

    /*
    |--------------------------------------------------------------------------
    | 2. جلب الأوبشنز (Options) لجميع المنتجات دفعة واحدة (طريقة احترافية وعالية الأداء)
    |--------------------------------------------------------------------------
    */
    $groupedOptions = [];

    if (!empty($products)) {
        // استخراج جميع الـ IDs للمنتجات المسترجعة
        $productIds = array_column($products, 'id');
        
        // تجهيز علامات استفهام مساوية لعدد المنتجات للاستخدام في الـ IN Clause
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        
        $stmtOptions = $pdo->prepare("
            SELECT 
                id,
                product_id,
                option_name,
                type_size,
                sku,
                cbm,
                image_path
            FROM product_options 
            WHERE product_id IN ($placeholders)
        ");
        
        $stmtOptions->execute($productIds);
        $allOptions = $stmtOptions->fetchAll();

        // تجميع الأوبشنز وفهرستها برقم المنتج (Product ID)
        foreach ($allOptions as $option) {
            $pId = (int)$option['product_id'];
            
            $groupedOptions[$pId][] = [
                "id"          => (int)$option['id'],
                "option_name" => $option['option_name'],
                "type_size"   => $option['type_size'],
                "sku"         => $option['sku'],
                "cbm"         => $option['cbm'],
                "image_path"  => $option['image_path']
            ];
        }
    }

    /*
    |--------------------------------------------------------------------------
    | 3. الـ Loop لعمل الـ Cast وتوزيع الأوبشنز على منتجاتها المقابلة
    |--------------------------------------------------------------------------
    */
    foreach ($products as &$product) {
        $pId = (int)$product['id'];

        // تحويل الأنواع لـ Integers ونظافة الـ JSON
        $product['id'] = $pId;
        $product['brand_id'] = (int)$product['brand_id'];
        $product['category_id'] = $product['category_id'] !== null ? (int)$product['category_id'] : null;
        $product['sub_category_id'] = $product['sub_category_id'] !== null ? (int)$product['sub_category_id'] : null;

        // دمج مصفوفة الأوبشنز الخاصة بهذا المنتج بالتحديد، وإرجاع مصفوفة فارغة إذا لم يكن له أوبشنز
        $product['options'] = $groupedOptions[$pId] ?? [];
    }

    // إرسال الرد النهائي بنجاح ومعه قائمة المنتجات كاملة بالأوبشنز
    jsonResponse(true, "Products retrieved successfully", [
        "products" => $products,
        "count" => count($products)
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}