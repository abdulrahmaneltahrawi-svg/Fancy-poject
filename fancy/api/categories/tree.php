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

try {
    $stmt = $pdo->prepare("
        SELECT
            id,
            name,
            slug,
            status,
            sort_order
        FROM categories
        WHERE status = 'active'
        ORDER BY sort_order ASC, id ASC
    ");
    $stmt->execute();
    $categories = $stmt->fetchAll();

    $stmt = $pdo->prepare("
        SELECT
            id,
            category_id,
            name,
            slug,
            status,
            sort_order
        FROM sub_categories
        WHERE status = 'active'
        ORDER BY sort_order ASC, id ASC
    ");
    $stmt->execute();
    $subCategories = $stmt->fetchAll();

    $subCategoriesByCategory = [];

    foreach ($subCategories as $subCategory) {
        $categoryId = (int)$subCategory['category_id'];

        $subCategoriesByCategory[$categoryId][] = [
            "id" => (int)$subCategory['id'],
            "category_id" => $categoryId,
            "name" => $subCategory['name'],
            "slug" => $subCategory['slug'],
            "sort_order" => (int)$subCategory['sort_order']
        ];
    }

    $result = [];

    foreach ($categories as $category) {
        $categoryId = (int)$category['id'];

        $result[] = [
            "id" => $categoryId,
            "name" => $category['name'],
            "slug" => $category['slug'],
            "sort_order" => (int)$category['sort_order'],
            "sub_categories" => $subCategoriesByCategory[$categoryId] ?? []
        ];
    }

    jsonResponse(true, "Category tree retrieved successfully", [
        "categories" => $result,
        "count" => count($result)
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}