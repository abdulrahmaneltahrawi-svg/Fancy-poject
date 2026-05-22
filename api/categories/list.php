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

    foreach ($categories as &$category) {
        $category['id'] = (int)$category['id'];
        $category['sort_order'] = (int)$category['sort_order'];
    }

    jsonResponse(true, "Categories retrieved successfully", [
        "categories" => $categories,
        "count" => count($categories)
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}