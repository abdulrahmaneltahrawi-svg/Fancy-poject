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

requireAdmin();

try {
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
            products.main_image,
            products.status,
            products.created_at,

            brands.brand_name,

            users.first_name,
            users.last_name,
            users.email AS user_email,

            categories.name AS category_name,
            sub_categories.name AS sub_category_name

        FROM products

        INNER JOIN brands
            ON brands.id = products.brand_id

        INNER JOIN users
            ON users.id = products.user_id

        LEFT JOIN categories
            ON categories.id = products.category_id

        LEFT JOIN sub_categories
            ON sub_categories.id = products.sub_category_id

        WHERE products.status = 'pending_admin_approval'

        ORDER BY products.id DESC
    ");

    $stmt->execute();
    $products = $stmt->fetchAll();

    foreach ($products as &$product) {
        $product['id'] = (int)$product['id'];
        $product['user_id'] = (int)$product['user_id'];
        $product['brand_id'] = (int)$product['brand_id'];
        $product['category_id'] = $product['category_id'] !== null ? (int)$product['category_id'] : null;
        $product['sub_category_id'] = $product['sub_category_id'] !== null ? (int)$product['sub_category_id'] : null;
    }

    jsonResponse(true, "Pending products retrieved successfully", [
        "products" => $products,
        "count" => count($products)
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}