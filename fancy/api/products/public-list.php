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

// استقبال الفلاتر وعمل Cast لها
$categoryId = isset($_GET['category_id']) && $_GET['category_id'] !== ''
    ? (int)$_GET['category_id']
    : null;

$subCategoryId = isset($_GET['sub_category_id']) && $_GET['sub_category_id'] !== ''
    ? (int)$_GET['sub_category_id']
    : null;

$brandId = isset($_GET['brand_id']) && $_GET['brand_id'] !== ''
    ? (int)$_GET['brand_id']
    : null;

$search = cleanInput($_GET['search'] ?? '');

try {
    /*
    |--------------------------------------------------------------------------
    | 1. بناء الاستعلام الأساسي للفهرس العام (المنتجات النشطة فقط)
    |--------------------------------------------------------------------------
    | هنا الاستعلام مأمن تلقائياً ضد المنتجات الممسوحة لأن شرط [products.status = 'active']
    | يستبعد تماماً أي منتج حالته 'deleted'.
    */
    $sql = "
        SELECT
            products.id,
            products.brand_id,
            products.category_id,
            products.sub_category_id,
            products.product_name,
            products.slug,
            products.short_description,
            products.main_image,
            products.status,
            products.created_at,

            brands.brand_name,
            brands.logo AS brand_logo,

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

        WHERE products.status = 'active'
          AND brands.status = 'active'
    ";

    $params = [];

    // فلترة حسب القسم الرئيسي
    if ($categoryId !== null && $categoryId > 0) {
        $sql .= " AND products.category_id = ? ";
        $params[] = $categoryId;
    }

    // فلترة حسب القسم الفرعي
    if ($subCategoryId !== null && $subCategoryId > 0) {
        $sql .= " AND products.sub_category_id = ? ";
        $params[] = $subCategoryId;
    }

    // فلترة حسب البراند
    if ($brandId !== null && $brandId > 0) {
        $sql .= " AND products.brand_id = ? ";
        $params[] = $brandId;
    }

    // نظام البحث الذكي (في الاسم، الوصف، واسم البراند)
    if ($search !== '') {
        $sql .= " AND (
            products.product_name LIKE ?
            OR products.short_description LIKE ?
            OR products.description LIKE ?
            OR brands.brand_name LIKE ?
        ) ";

        $searchTerm = "%" . $search . "%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    // ترتيب المنتجات من الأحدث للأقدم
    $sql .= " ORDER BY products.id DESC ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    /*
    |--------------------------------------------------------------------------
    | 2. جلب الأوبشنز (Options) لجميع المنتجات المسترجعة دفعة واحدة (استعلام واحد عالي الأداء)
    |--------------------------------------------------------------------------
    */
    $groupedOptions = [];

    if (!empty($products)) {
        $productIds = array_column($products, 'id');
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

        // تجميع الأوبشنز وفهرستها بالـ Product ID
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
    | 3. الـ Loop لتنظيف أنواع البيانات ودمج الـ Options داخل كل منتج
    |--------------------------------------------------------------------------
    */
    foreach ($products as &$product) {
        $pId = (int)$product['id'];

        $product['id'] = $pId;
        $product['brand_id'] = (int)$product['brand_id'];
        $product['category_id'] = $product['category_id'] !== null ? (int)$product['category_id'] : null;
        $product['sub_category_id'] = $product['sub_category_id'] !== null ? (int)$product['sub_category_id'] : null;

        // إلحاق مصفوفة الأوبشنز بالمنتج الحالي (مصفوفة فارغة إذا لم يتوفر له أوبشنز)
        $product['options'] = $groupedOptions[$pId] ?? [];
    }

    // إرسال الرد النهائي
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