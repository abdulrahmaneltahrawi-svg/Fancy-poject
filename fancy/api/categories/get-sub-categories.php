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

$categoryId = (int)($_GET['category_id'] ?? 0);

if ($categoryId <= 0) {
    jsonResponse(false, "Category ID is required", [
        "code" => "CATEGORY_ID_REQUIRED"
    ], 422);
}

try {
    $stmt = $pdo->prepare("
        SELECT
            id,
            name,
            slug,
            status,
            sort_order
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

    $stmt = $pdo->prepare("
        SELECT
            id,
            category_id,
            name,
            slug,
            status,
            sort_order
        FROM sub_categories
        WHERE category_id = ?
          AND status = 'active'
        ORDER BY sort_order ASC, id ASC
    ");

    $stmt->execute([$categoryId]);
    $subCategories = $stmt->fetchAll();

    foreach ($subCategories as &$subCategory) {
        $subCategory['id'] = (int)$subCategory['id'];
        $subCategory['category_id'] = (int)$subCategory['category_id'];
        $subCategory['sort_order'] = (int)$subCategory['sort_order'];
    }

    jsonResponse(true, "Sub categories retrieved successfully", [
        "category" => [
            "id" => (int)$category['id'],
            "name" => $category['name'],
            "slug" => $category['slug']
        ],
        "sub_categories" => $subCategories,
        "count" => count($subCategories)
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}