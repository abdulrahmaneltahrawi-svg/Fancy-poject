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

    if ($categoryId !== null && $categoryId > 0) {
        $sql .= " AND products.category_id = ? ";
        $params[] = $categoryId;
    }

    if ($subCategoryId !== null && $subCategoryId > 0) {
        $sql .= " AND products.sub_category_id = ? ";
        $params[] = $subCategoryId;
    }

    if ($brandId !== null && $brandId > 0) {
        $sql .= " AND products.brand_id = ? ";
        $params[] = $brandId;
    }

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

    $sql .= " ORDER BY products.id DESC ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $products = $stmt->fetchAll();

    foreach ($products as &$product) {
        $product['id'] = (int)$product['id'];
        $product['brand_id'] = (int)$product['brand_id'];
        $product['category_id'] = $product['category_id'] !== null ? (int)$product['category_id'] : null;
        $product['sub_category_id'] = $product['sub_category_id'] !== null ? (int)$product['sub_category_id'] : null;
    }

    jsonResponse(true, "Products retrieved successfully", [
        "products" => $products,
        "count" => count($products)
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}