<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";

// 1. التأكد أن الطلب من نوع GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

try {
    // 2. استقبال كلمة البحث من الـ URL (مثال: ?q=lux)
    $keyword = trim($_POST['q'] ?? $_GET['q'] ?? '');

    // ✅ السطر الجديد: هيرفض فقط لو خانة البحث فارغة تماماً
    if (empty($keyword)) {
        jsonResponse(true, "Search keyword is empty", [
            "brands"   => [],
            "projects" => [],
            "products" => []
        ], 200);
    }

    // تجهيز الكلمة للبحث باستخدام LIKE في الداتا بيز
    $searchParam = "%" . $keyword . "%";

    // ---------------------------------------------------
    // 🔍 أولاً: البحث في جدول البراندات (Brands) 
    // ---------------------------------------------------
    // العمود الحقيقي هو brand_name والصورة هي logo
    $stmtBrands = $pdo->prepare("
        SELECT id, brand_name as name, logo as image, 'brand' as type 
        FROM brands 
        WHERE brand_name LIKE ? 
        LIMIT 10
    ");
    $stmtBrands->execute([$searchParam]);
    $brands = $stmtBrands->fetchAll(PDO::FETCH_ASSOC);

    // معالجة روابط صور البراندات
    foreach ($brands as &$b) {
        $b['image_url'] = !empty($b['image']) ? rtrim(APP_URL, '/') . '/' . ltrim($b['image'], '/') : null;
        unset($b['image']); 
    }

    // ---------------------------------------------------
    // 🔍 ثانياً: البحث في جدول المشاريع (Projects)
    // ---------------------------------------------------
    // العمود الحقيقي هو title والصورة هي cover_image
    $stmtProjects = $pdo->prepare("
        SELECT id, title as name, cover_image as image, 'project' as type 
        FROM projects 
        WHERE status = 'approved' AND (title LIKE ? OR description LIKE ?) 
        LIMIT 10
    ");
    $stmtProjects->execute([$searchParam, $searchParam]);
    $projects = $stmtProjects->fetchAll(PDO::FETCH_ASSOC);

    // معالجة روابط صور غلاف المشاريع
    foreach ($projects as &$p) {
        $p['image_url'] = !empty($p['image']) ? rtrim(APP_URL, '/') . '/' . ltrim($p['image'], '/') : null;
        unset($p['image']);
    }

    // ---------------------------------------------------
    // 🔍 ثالثاً: البحث في جدول المنتجات (Products)
    // ---------------------------------------------------
    // العمود الحقيقي هو product_name والصورة هي main_image
    $stmtProducts = $pdo->prepare("
        SELECT id, product_name as name, main_image as image, 'product' as type 
        FROM products 
        WHERE product_name LIKE ? OR description LIKE ? OR short_description LIKE ?
        LIMIT 10
    ");
    $stmtProducts->execute([$searchParam, $searchParam, $searchParam]);
    $products = $stmtProducts->fetchAll(PDO::FETCH_ASSOC);

    // معالجة روابط صور المنتجات
    foreach ($products as &$pr) {
        $pr['image_url'] = !empty($pr['image']) ? rtrim(APP_URL, '/') . '/' . ltrim($pr['image'], '/') : null;
        unset($pr['image']);
    }

    // ---------------------------------------------------
    // 📦 تجميع ودمج النتائج في مصفوفة واحدة منظمة
    // ---------------------------------------------------
    $searchResults = [
        "brands"   => $brands,
        "projects" => $projects,
        "products" => $products,
        "total_results" => count($brands) + count($projects) + count($products)
    ];

    jsonResponse(true, "Search results fetched successfully", $searchResults, 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong during search", ["error" => $e->getMessage()], 500);
}